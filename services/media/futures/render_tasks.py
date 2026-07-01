import gc
import hashlib
import logging
import os
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, replace
from typing import Any

import httpx
from celery import Celery
from moviepy import AudioFileClip, ColorClip

try:
    import psutil
except ImportError:  # pragma: no cover
    psutil = None

from media.config import PUBLIC_VIDEO_BASE_URL, REDIS_URL, RENDER_BGM_PATH
from media.services.elevenlabs import generate_voiceover
from media.services.stock import search_pexels_videos, search_pexels_photos
from media.futures.render_composition import (
    RenderProfile,
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

celery_app = Celery(
    "video_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

_MEDIA_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ASSET_CACHE_DIR = os.path.join(_MEDIA_ROOT, "static", ".render-cache")
_DOWNLOAD_RETRIES = int(os.getenv("RENDER_DOWNLOAD_RETRIES", "3"))
_PARALLEL_SCENES = os.getenv("RENDER_PARALLEL_SCENES", "false").lower() in {"1", "true", "yes"}


def _log_memory(label: str) -> None:
    if psutil is None:
        return
    try:
        proc = psutil.Process()
        rss_mb = proc.memory_info().rss / (1024 * 1024)
        logger.info("[memory] %s — RSS %.0f MB", label, rss_mb)
    except Exception as exc:
        logger.debug("Memory log failed for %s: %s", label, exc)


@dataclass
class SceneSpec:
    scene_num: int
    scene_idx: int
    duration: float
    audio_path: str | None
    asset_path: str | None
    is_video_asset: bool


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

    if url.startswith("data:"):
        import base64

        _, encoded = url.split(",", 1)
        data = base64.b64decode(encoded)
        cache_key = hashlib.sha256(data).hexdigest()
        cached_path = os.path.join(_ASSET_CACHE_DIR, f"{cache_key}{suffix}")
        if not os.path.isfile(cached_path) or os.path.getsize(cached_path) == 0:
            with open(cached_path, "wb") as handle:
                handle.write(data)
        logger.info("Materialized data URL asset (%d KB) → %s", len(data) // 1024, cached_path)
        return cached_path

    static_marker = "/media/static/"
    if static_marker in url:
        rel_path = url.split(static_marker, 1)[1].split("?", 1)[0]
        local_path = os.path.join(_MEDIA_ROOT, "static", rel_path)
        if os.path.isfile(local_path) and os.path.getsize(local_path) > 0:
            logger.info("Using local static asset → %s", local_path)
            return local_path

    if url.startswith("/"):
        url = f"http://127.0.0.1:8003{url.replace('/media/static/', '/static/')}"

    cache_key = hashlib.sha256(url.encode("utf-8")).hexdigest()
    cached_path = os.path.join(_ASSET_CACHE_DIR, f"{cache_key}{suffix}")
    if os.path.isfile(cached_path) and os.path.getsize(cached_path) > 0:
        logger.debug("Asset cache hit: %s", cached_path)
        return cached_path

    logger.info("Downloading asset: %s", url[:120])
    last_error: Exception | None = None

    for attempt in range(1, _DOWNLOAD_RETRIES + 1):
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
            last_error = exc
            if os.path.exists(temp_path):
                os.remove(temp_path)
            if attempt < _DOWNLOAD_RETRIES:
                delay = 0.5 * (2 ** (attempt - 1))
                logger.warning(
                    "Download attempt %d/%d failed (%s), retrying in %.1fs",
                    attempt,
                    _DOWNLOAD_RETRIES,
                    exc,
                    delay,
                )
                time.sleep(delay)

    raise RuntimeError(f"Failed to download asset {url}: {last_error}") from last_error


def _resolve_asset_url(
    scene_num: int,
    visual_prompt: str,
    scene_images: list[dict],
    scene_videos: list[dict],
) -> tuple[str | None, bool]:
    for sv in scene_videos:
        if sv.get("sceneNumber") == scene_num and sv.get("videoUrl"):
            return sv.get("videoUrl"), True

    for si in scene_images:
        if si.get("sceneNumber") == scene_num and si.get("imageUrl"):
            return si.get("imageUrl"), False

    if not visual_prompt:
        return None, False

    logger.info("Scene %s: no asset selected, searching Pexels", scene_num)
    videos = search_pexels_videos(visual_prompt)
    if videos:
        return videos[0].get("videoUrl"), True

    logger.info("Scene %s: no stock videos, searching photos", scene_num)
    photos = search_pexels_photos(visual_prompt)
    if photos:
        return photos[0].get("imageUrl"), False

    return None, False


def _render_segment_from_spec(
    spec: SceneSpec,
    *,
    profile: RenderProfile,
    target_w: int,
    target_h: int,
) -> tuple[int, str]:
    """Compose and encode one scene segment (thread-safe; ffmpeg releases GIL)."""
    audio_clip = None
    if spec.audio_path:
        audio_clip = AudioFileClip(spec.audio_path)

    if spec.asset_path:
        base_clip = load_visual_clip(spec.asset_path, spec.duration, spec.is_video_asset)
    else:
        base_clip = ColorClip(size=(target_w, target_h), color=(30, 30, 30)).with_duration(
            spec.duration
        )

    clip = build_cinematic_scene_clip(
        base_clip,
        duration=spec.duration,
        target_w=target_w,
        target_h=target_h,
        is_video=spec.is_video_asset,
        profile=profile,
    )

    if audio_clip:
        clip = clip.with_audio(audio_clip)

    fd, segment_path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    try:
        write_scene_segment(clip, segment_path, profile, scene_label=f"scene_{spec.scene_num}")
    finally:
        clip.close()
        if audio_clip:
            audio_clip.close()
        try:
            base_clip.close()
        except Exception:
            pass
        gc.collect()
    _log_memory(f"after scene {spec.scene_num} segment encode")
    logger.info("Scene %s segment written: %s", spec.scene_num, segment_path)
    return spec.scene_idx, segment_path


def _prepare_scene_spec(
    *,
    idx: int,
    scene: dict,
    storyboard: list[dict],
    total_scenes: int,
    scene_images: list[dict],
    scene_videos: list[dict],
    include_audio: bool,
    request_ids: list[str],
    temp_files: list[str],
) -> SceneSpec:
    scene_num = scene.get("sceneNumber")
    narration_text = scene.get("narrationText", "")
    visual_prompt = scene.get("visualPrompt", "")

    prev_narration = storyboard[idx - 1].get("narrationText", "") if idx > 0 else None
    next_narration = (
        storyboard[idx + 1].get("narrationText", "") if idx + 1 < total_scenes else None
    )

    duration = 5.0
    audio_path: str | None = None

    if include_audio and narration_text:
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
                vo_duration = audio_clip.duration
                duration = vo_duration + scene_tail_pause(narration_text)
                audio_clip.close()
                audio_path = temp_audio_path
                logger.info(
                    "Scene %s voiceover ready (%.2fs + tail)",
                    scene_num,
                    vo_duration,
                )
            except Exception as exc:
                logger.warning("Scene %s failed to load audio: %s", scene_num, exc)
        else:
            logger.warning("Scene %s voiceover generation failed", scene_num)

    asset_url, is_video_asset = _resolve_asset_url(
        scene_num, visual_prompt, scene_images, scene_videos
    )
    asset_path: str | None = None

    if asset_url:
        try:
            suffix = ".mp4" if is_video_asset else ".jpg"
            asset_path = download_file(asset_url, suffix)
            if not asset_path.startswith(_ASSET_CACHE_DIR):
                temp_files.append(asset_path)
        except Exception as exc:
            logger.warning("Scene %s asset load failed: %s", scene_num, exc)
            asset_path = None

    return SceneSpec(
        scene_num=scene_num,
        scene_idx=idx,
        duration=duration,
        audio_path=audio_path,
        asset_path=asset_path,
        is_video_asset=is_video_asset,
    )


def _render_scenes_parallel(
    specs: list[SceneSpec],
    *,
    profile: RenderProfile,
    target_w: int,
    target_h: int,
    temp_files: list[str],
) -> list[str]:
    max_workers = min(
        len(specs),
        int(os.getenv("RENDER_PARALLEL_MAX", str(max(profile.threads // 2, 2)))),
    )
    logger.info("Parallel segment render: %d scenes, %d workers", len(specs), max_workers)

    segment_by_idx: dict[int, str] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                _render_segment_from_spec,
                spec,
                profile=profile,
                target_w=target_w,
                target_h=target_h,
            ): spec
            for spec in specs
        }
        for future in as_completed(futures):
            spec = futures[future]
            scene_idx, segment_path = future.result()
            temp_files.append(segment_path)
            segment_by_idx[scene_idx] = segment_path

    return [segment_by_idx[i] for i in range(len(specs))]


@celery_app.task(bind=True)
def render_video(self, project_id: str, payload: dict):
    """Compile visual assets and voice narration into a final video."""
    storyboard = payload.get("storyboard", [])
    scene_images = payload.get("sceneImages", [])
    scene_videos = payload.get("sceneVideos", [])
    content_format = payload.get("contentFormat", "long")
    include_audio = bool(payload.get("includeAudio", False))
    render_quality = payload.get("renderQuality")

    profile = get_render_profile(content_format, quality=render_quality)
    target_w, target_h = profile.target_w, profile.target_h
    started_at = time.monotonic()

    total_scenes = len(storyboard)
    if total_scenes == 0:
        logger.error("[render %s] Storyboard is empty", self.request.id)
        return {"status": "failed", "progress": 0, "error": "Storyboard is empty."}

    # Multi-scene renders OOM in compose+crossfade mode — prefer segmented unless opted out
    if total_scenes >= 2 and not profile.segmented:
        seg_opt_out = os.getenv("RENDER_SEGMENTED", "true").lower() in {"0", "false", "no"}
        if not seg_opt_out:
            profile = replace(profile, segmented=True)
            logger.info(
                "[render %s] Auto-enabled segmented mode for %d scenes (memory safety)",
                self.request.id,
                total_scenes,
            )

    _log_memory("render start")

    parallel_segments = profile.segmented and _PARALLEL_SCENES and total_scenes > 1

    logger.info(
        "[render %s] Starting project=%s scenes=%d format=%s quality=%s profile=%dx%d "
        "codec=%s segmented=%s parallel=%s include_audio=%s",
        self.request.id,
        project_id,
        total_scenes,
        content_format,
        render_quality or os.getenv("RENDER_QUALITY", "balanced"),
        target_w,
        target_h,
        profile.codec,
        profile.segmented,
        parallel_segments,
        include_audio,
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

    scene_clips: list[Any] = []
    segment_paths: list[str] = []
    temp_files: list[str] = []

    try:
        request_ids: list[str] = []

        if parallel_segments:
            specs: list[SceneSpec] = []
            for idx, scene in enumerate(storyboard):
                scene_num = scene.get("sceneNumber")
                progress_val = int((idx / total_scenes) * 60)
                _report_progress(
                    self,
                    progress_val,
                    f"Scene {scene_num}/{total_scenes}: preparing"
                    + (" (voiceover + assets)" if include_audio else " (visual assets)"),
                    started_at=started_at,
                    scene=scene_num,
                    total_scenes=total_scenes,
                )
                specs.append(
                    _prepare_scene_spec(
                        idx=idx,
                        scene=scene,
                        storyboard=storyboard,
                        total_scenes=total_scenes,
                        scene_images=scene_images,
                        scene_videos=scene_videos,
                        include_audio=include_audio,
                        request_ids=request_ids,
                        temp_files=temp_files,
                    )
                )

            _report_progress(
                self,
                65,
                f"Encoding {len(specs)} scenes in parallel",
                started_at=started_at,
                total_scenes=total_scenes,
            )
            segment_paths = _render_scenes_parallel(
                specs,
                profile=profile,
                target_w=target_w,
                target_h=target_h,
                temp_files=temp_files,
            )
        else:
            for idx, scene in enumerate(storyboard):
                scene_num = scene.get("sceneNumber")
                progress_val = int((idx / total_scenes) * 80)
                _report_progress(
                    self,
                    progress_val,
                    f"Scene {scene_num}/{total_scenes}: starting",
                    started_at=started_at,
                    scene=scene_num,
                    total_scenes=total_scenes,
                )

                spec = _prepare_scene_spec(
                    idx=idx,
                    scene=scene,
                    storyboard=storyboard,
                    total_scenes=total_scenes,
                    scene_images=scene_images,
                    scene_videos=scene_videos,
                    include_audio=include_audio,
                    request_ids=request_ids,
                    temp_files=temp_files,
                )

                if include_audio and scene.get("narrationText"):
                    _report_progress(
                        self,
                        progress_val,
                        f"Scene {scene_num}/{total_scenes}: composing cinematic layers",
                        started_at=started_at,
                        scene=scene_num,
                        total_scenes=total_scenes,
                    )

                if profile.segmented:
                    _report_progress(
                        self,
                        progress_val,
                        f"Scene {scene_num}/{total_scenes}: encoding segment (FFmpeg)",
                        started_at=started_at,
                        scene=scene_num,
                        total_scenes=total_scenes,
                    )
                    _, segment_path = _render_segment_from_spec(
                        spec,
                        profile=profile,
                        target_w=target_w,
                        target_h=target_h,
                    )
                    temp_files.append(segment_path)
                    segment_paths.append(segment_path)
                    gc.collect()
                    _log_memory(f"after scene {scene_num} segment")
                else:
                    audio_clip = None
                    if spec.audio_path:
                        audio_clip = AudioFileClip(spec.audio_path)

                    if spec.asset_path:
                        base_clip = load_visual_clip(
                            spec.asset_path, spec.duration, spec.is_video_asset
                        )
                    else:
                        logger.warning(
                            "Scene %s using blank fallback clip (%.1fs)",
                            scene_num,
                            spec.duration,
                        )
                        base_clip = ColorClip(
                            size=(target_w, target_h), color=(30, 30, 30)
                        ).with_duration(spec.duration)

                    clip = build_cinematic_scene_clip(
                        base_clip,
                        duration=spec.duration,
                        target_w=target_w,
                        target_h=target_h,
                        is_video=spec.is_video_asset,
                        profile=profile,
                    )

                    if audio_clip:
                        clip = clip.with_audio(audio_clip)

                    scene_clips.append(clip)
                    _log_memory(f"after scene {scene_num} compose (in-memory)")

        _log_memory("before finalize")
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
            "videoUrl": f"{PUBLIC_VIDEO_BASE_URL}/static/{output_filename}",
        }

    except Exception as exc:
        logger.exception("[render %s] Failed: %s", self.request.id, exc)
        err = str(exc).split("\n")[0][:300]
        if "Broken pipe" in err or "unsharp" in err.lower() or "Invalid argument" in err:
            err = (
                "FFmpeg encode failed (LUT/unsharp filter + VideoToolbox). "
                "Retried without filters — if this persists, clear RENDER_LUT_PATH / "
                "RENDER_UNSHARP_PARAMS in services/.env and restart Celery."
            )
        return {"status": "failed", "progress": 0, "error": err}

    finally:
        logger.debug("[render %s] Cleaning up %d temp files", self.request.id, len(temp_files))
        for path in temp_files:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as cle:
                    logger.warning("Failed to delete temp file %s: %s", path, cle)
