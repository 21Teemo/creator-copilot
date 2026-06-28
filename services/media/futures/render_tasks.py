import hashlib
import logging
import os
import tempfile
import time
import httpx
from celery import Celery
from moviepy import AudioFileClip, ColorClip

from media.config import REDIS_URL, RENDER_BGM_PATH
from media.services.elevenlabs import generate_voiceover
from media.services.stock import search_pexels_videos, search_pexels_photos
from media.futures.render_composition import (
    apply_scene_crossfades,
    build_cinematic_scene_clip,
    concat_segment_files,
    get_render_profile,
    load_visual_clip,
    mix_bgm_into_video_file,
    mix_voice_and_bgm,
    scene_tail_pause,
    write_render_output,
    write_scene_segment,
)

logger = logging.getLogger("media.render")

# Setup Celery client
celery_app = Celery(
    "video_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
)

_MEDIA_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ASSET_CACHE_DIR = os.path.join(_MEDIA_ROOT, "static", ".render-cache")


def _report_progress(
    task,
    progress: int,
    step: str,
    *,
    started_at: float,
    scene: int | None = None,
    total_scenes: int | None = None,
) -> None:
    elapsed = round(time.monotonic() - started_at, 1)
    meta: dict = {"progress": progress, "step": step, "elapsed_sec": elapsed}
    if scene is not None:
        meta["scene"] = scene
    if total_scenes is not None:
        meta["total_scenes"] = total_scenes
    logger.info(
        "[render %s] %d%% — %s (%.1fs elapsed)",
        task.request.id,
        progress,
        step,
        elapsed,
    )
    task.update_state(state="PROGRESS", meta=meta)


def download_file(url: str, suffix: str) -> str:
    os.makedirs(_ASSET_CACHE_DIR, exist_ok=True)
    cache_key = hashlib.sha256(url.encode("utf-8")).hexdigest()
    cached_path = os.path.join(_ASSET_CACHE_DIR, f"{cache_key}{suffix}")
    if os.path.isfile(cached_path) and os.path.getsize(cached_path) > 0:
        logger.debug("Asset cache hit: %s", cached_path)
        return cached_path

    logger.info("Downloading asset: %s", url[:120])

    fd, temp_path = tempfile.mkstemp(suffix=suffix, dir=_ASSET_CACHE_DIR)
    os.close(fd)
    try:
        with httpx.Client(follow_redirects=True) as client:
            res = client.get(url, timeout=60.0)
            res.raise_for_status()
            with open(temp_path, "wb") as handle:
                handle.write(res.content)
        os.replace(temp_path, cached_path)
        size_kb = os.path.getsize(cached_path) // 1024
        logger.info("Downloaded asset (%d KB) → %s", size_kb, cached_path)
        return cached_path
    except Exception as exc:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise RuntimeError(f"Failed to download asset {url}: {exc}") from exc

@celery_app.task(bind=True)
def render_video(self, project_id: str, payload: dict):
    """
    Celery task that compiles visual assets (images/videos) and voice narration
    into a final video using MoviePy 2.0 and FFmpeg.
    """
    storyboard = payload.get("storyboard", [])
    scene_images = payload.get("sceneImages", [])
    scene_videos = payload.get("sceneVideos", [])
    content_format = payload.get("contentFormat", "long")
    include_audio = payload.get("includeAudio", True)
    render_quality = payload.get("renderQuality")

    profile = get_render_profile(content_format, quality=render_quality)
    target_w, target_h = profile.target_w, profile.target_h
    started_at = time.monotonic()

    total_scenes = len(storyboard)
    if total_scenes == 0:
        logger.error("[render %s] Storyboard is empty", self.request.id)
        return {"status": "failed", "progress": 0, "error": "Storyboard is empty."}

    logger.info(
        "[render %s] Starting project=%s scenes=%d format=%s quality=%s profile=%dx%d codec=%s segmented=%s",
        self.request.id,
        project_id,
        total_scenes,
        content_format,
        render_quality or os.getenv("RENDER_QUALITY", "balanced"),
        target_w,
        target_h,
        profile.codec,
        profile.segmented,
    )
    if profile.segmented:
        logger.info(
            "[render %s] Segmented mode: hard cuts between scenes (no crossfades). "
            "Set RENDER_SEGMENTED=false for crossfade transitions.",
            self.request.id,
        )
    _report_progress(
        self,
        1,
        "Initializing render pipeline",
        started_at=started_at,
        total_scenes=total_scenes,
    )

    scene_clips = []
    segment_paths: list[str] = []
    temp_files = []
    cached_downloads: set[str] = set()
    
    try:
        request_ids: list[str] = []

        for idx, scene in enumerate(storyboard):
            scene_num = scene.get("sceneNumber")
            narration_text = scene.get("narrationText", "")
            visual_prompt = scene.get("visualPrompt", "")

            prev_narration = storyboard[idx - 1].get("narrationText", "") if idx > 0 else None
            next_narration = (
                storyboard[idx + 1].get("narrationText", "") if idx + 1 < total_scenes else None
            )
            
            progress_val = int((idx / total_scenes) * 80)
            _report_progress(
                self,
                progress_val,
                f"Scene {scene_num}/{total_scenes}: starting",
                started_at=started_at,
                scene=scene_num,
                total_scenes=total_scenes,
            )
            
            duration = 5.0
            audio_clip = None
            
            if include_audio and narration_text:
                _report_progress(
                    self,
                    progress_val,
                    f"Scene {scene_num}/{total_scenes}: generating voiceover",
                    started_at=started_at,
                    scene=scene_num,
                    total_scenes=total_scenes,
                )
                fd, temp_audio_path = tempfile.mkstemp(suffix=".mp3")
                os.close(fd)
                temp_files.append(temp_audio_path)
                
                ok, request_id = generate_voiceover(
                    narration_text,
                    temp_audio_path,
                    previous_text=prev_narration,
                    next_text=next_narration,
                    previous_request_ids=request_ids or None,
                )
                if ok:
                    if request_id:
                        request_ids.append(request_id)
                    try:
                        audio_clip = AudioFileClip(temp_audio_path)
                        duration = audio_clip.duration + scene_tail_pause(narration_text)
                        logger.info(
                            "Scene %s voiceover ready (%.2fs + tail)",
                            scene_num,
                            audio_clip.duration,
                        )
                    except Exception as ae:
                        logger.warning("Scene %s failed to load audio: %s", scene_num, ae)
                        audio_clip = None
                else:
                    logger.warning("Scene %s voiceover generation failed", scene_num)
            
            asset_url = None
            is_video_asset = False
            
            for sv in scene_videos:
                if sv.get("sceneNumber") == scene_num and sv.get("videoUrl"):
                    asset_url = sv.get("videoUrl")
                    is_video_asset = True
                    break
                    
            if not asset_url:
                for si in scene_images:
                    if si.get("sceneNumber") == scene_num and si.get("imageUrl"):
                        asset_url = si.get("imageUrl")
                        is_video_asset = False
                        break
                        
            if not asset_url and visual_prompt:
                logger.info("Scene %s: no asset selected, searching Pexels", scene_num)
                videos = search_pexels_videos(visual_prompt)
                if videos:
                    asset_url = videos[0].get("videoUrl")
                    is_video_asset = True
                else:
                    logger.info("Scene %s: no stock videos, searching photos", scene_num)
                    photos = search_pexels_photos(visual_prompt)
                    if photos:
                        asset_url = photos[0].get("imageUrl")
                        is_video_asset = False
            
            base_clip = None
            if asset_url:
                try:
                    _report_progress(
                        self,
                        progress_val,
                        f"Scene {scene_num}/{total_scenes}: loading {'video' if is_video_asset else 'image'} asset",
                        started_at=started_at,
                        scene=scene_num,
                        total_scenes=total_scenes,
                    )
                    suffix = ".mp4" if is_video_asset else ".jpg"
                    temp_path = download_file(asset_url, suffix)
                    if not temp_path.startswith(_ASSET_CACHE_DIR):
                        temp_files.append(temp_path)
                    else:
                        cached_downloads.add(temp_path)
                    base_clip = load_visual_clip(temp_path, duration, is_video_asset)
                except Exception as ve:
                    logger.warning("Scene %s asset load failed: %s — using fallback", scene_num, ve)
                    base_clip = None
                    
            if base_clip is None:
                logger.warning("Scene %s using blank fallback clip (%.1fs)", scene_num, duration)
                base_clip = ColorClip(size=(target_w, target_h), color=(30, 30, 30)).with_duration(duration)

            _report_progress(
                self,
                progress_val,
                f"Scene {scene_num}/{total_scenes}: composing cinematic layers",
                started_at=started_at,
                scene=scene_num,
                total_scenes=total_scenes,
            )
            clip = build_cinematic_scene_clip(
                base_clip,
                duration=duration,
                target_w=target_w,
                target_h=target_h,
                is_video=is_video_asset,
                profile=profile,
            )
            base_clip.close()

            if audio_clip:
                clip = clip.with_audio(audio_clip)

            if profile.segmented:
                _report_progress(
                    self,
                    progress_val,
                    f"Scene {scene_num}/{total_scenes}: encoding segment (FFmpeg)",
                    started_at=started_at,
                    scene=scene_num,
                    total_scenes=total_scenes,
                )
                fd, segment_path = tempfile.mkstemp(suffix=".mp4")
                os.close(fd)
                temp_files.append(segment_path)
                write_scene_segment(clip, segment_path, profile, scene_label=f"scene_{scene_num}")
                clip.close()
                segment_paths.append(segment_path)
                logger.info("Scene %s segment written: %s", scene_num, segment_path)
            else:
                scene_clips.append(clip)

        _report_progress(
            self,
            85,
            "Finalizing video",
            started_at=started_at,
            total_scenes=total_scenes,
        )
        static_dir = os.path.join(_MEDIA_ROOT, "static")
        os.makedirs(static_dir, exist_ok=True)
        output_filename = f"{self.request.id}.mp4"
        output_path = os.path.join(static_dir, output_filename)

        if profile.segmented:
            _report_progress(
                self,
                88,
                f"Concatenating {len(segment_paths)} pre-rendered segments",
                started_at=started_at,
                total_scenes=total_scenes,
            )
            concat_path = output_path
            if RENDER_BGM_PATH:
                fd, concat_path = tempfile.mkstemp(suffix=".mp4")
                os.close(fd)
                temp_files.append(concat_path)
            concat_segment_files(segment_paths, concat_path)

            if RENDER_BGM_PATH:
                _report_progress(
                    self,
                    92,
                    "Mixing background music with ducking (audio-only, video copy)",
                    started_at=started_at,
                    total_scenes=total_scenes,
                )
                logger.info("Mixing BGM from %s (ffmpeg -c:v copy)", RENDER_BGM_PATH)
                mix_bgm_into_video_file(concat_path, RENDER_BGM_PATH, output_path)
            else:
                logger.info("No RENDER_BGM_PATH — skipping background music")
                if concat_path != output_path:
                    os.replace(concat_path, output_path)
        else:
            _report_progress(
                self,
                88,
                "Concatenating scenes with crossfades",
                started_at=started_at,
                total_scenes=total_scenes,
            )
            final_clip = apply_scene_crossfades(scene_clips, crossfade=profile.crossfade_sec)

            if RENDER_BGM_PATH:
                _report_progress(
                    self,
                    92,
                    "Mixing background music with ducking",
                    started_at=started_at,
                    total_scenes=total_scenes,
                )
                logger.info("Mixing BGM from %s", RENDER_BGM_PATH)
                final_clip = mix_voice_and_bgm(final_clip, RENDER_BGM_PATH)
            else:
                logger.info("No RENDER_BGM_PATH — skipping background music")

            _report_progress(
                self,
                95,
                "Encoding final output (FFmpeg)",
                started_at=started_at,
                total_scenes=total_scenes,
            )
            write_render_output(final_clip, output_path, profile, label="final")
            final_clip.close()
            for clip in scene_clips:
                clip.close()

        output_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        total_elapsed = round(time.monotonic() - started_at, 1)
        logger.info(
            "[render %s] Complete — %.1f MB in %.1fs → %s",
            self.request.id,
            output_size_mb,
            total_elapsed,
            output_path,
        )
        _report_progress(
            self,
            100,
            f"Complete ({output_size_mb:.1f} MB in {total_elapsed}s)",
            started_at=started_at,
            total_scenes=total_scenes,
        )
            
        return {
            "status": "complete",
            "progress": 100,
            "videoUrl": f"http://127.0.0.1:8003/static/{output_filename}"
        }
        
    except Exception as e:
        import traceback
        logger.exception("[render %s] Failed: %s", self.request.id, e)
        traceback.print_exc()
        self.update_state(
            state="FAILURE",
            meta={"progress": 100, "error": str(e), "step": f"Failed: {e}"},
        )
        return {"status": "failed", "progress": 0, "error": str(e)}
        
    finally:
        logger.debug("[render %s] Cleaning up %d temp files", self.request.id, len(temp_files))
        for f in temp_files:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception as cle:
                    logger.warning("Failed to delete temp file %s: %s", f, cle)
