import os
import tempfile
import httpx
from celery import Celery
from moviepy import VideoFileClip, AudioFileClip, ImageClip, ColorClip, concatenate_videoclips

from media.config import REDIS_URL
from media.services.elevenlabs import generate_voiceover
from media.services.stock import search_pexels_videos, search_pexels_photos

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

def download_file(url: str, suffix: str) -> str:
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        with httpx.Client(follow_redirects=True) as client:
            res = client.get(url, timeout=60.0)
            res.raise_for_status()
            with open(temp_path, "wb") as f:
                f.write(res.content)
        return temp_path
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise RuntimeError(f"Failed to download asset {url}: {e}")

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
    
    is_short = content_format == "short"
    target_w, target_h = (720, 1280) if is_short else (1280, 720)
    target_ratio = target_w / target_h
    
    total_scenes = len(storyboard)
    if total_scenes == 0:
        return {"status": "failed", "progress": 0, "error": "Storyboard is empty."}
        
    scene_clips = []
    temp_files = []
    
    try:
        for idx, scene in enumerate(storyboard):
            scene_num = scene.get("sceneNumber")
            narration_text = scene.get("narrationText", "")
            visual_prompt = scene.get("visualPrompt", "")
            
            # Step 1: Update progress
            progress_val = int((idx / total_scenes) * 80)
            self.update_state(state='PROGRESS', meta={'progress': progress_val})
            print(f"Processing scene {scene_num}/{total_scenes} ({progress_val}%)")
            
            # Step 2: Generate Voiceover (Audio)
            duration = 5.0  # Default duration for silent scenes
            audio_clip = None
            
            if include_audio and narration_text:
                fd, temp_audio_path = tempfile.mkstemp(suffix=".mp3")
                os.close(fd)
                temp_files.append(temp_audio_path)
                
                if generate_voiceover(narration_text, temp_audio_path):
                    try:
                        audio_clip = AudioFileClip(temp_audio_path)
                        duration = audio_clip.duration
                    except Exception as ae:
                        print(f"Failed to load audio clip: {ae}")
                        audio_clip = None
                else:
                    print(f"Voiceover generation failed for scene {scene_num}")
            
            # Step 3: Find visual asset URL
            asset_url = None
            is_video_asset = False
            
            # Check sceneVideos first
            for sv in scene_videos:
                if sv.get("sceneNumber") == scene_num and sv.get("videoUrl"):
                    asset_url = sv.get("videoUrl")
                    is_video_asset = True
                    break
                    
            # Check sceneImages next if no video
            if not asset_url:
                for si in scene_images:
                    if si.get("sceneNumber") == scene_num and si.get("imageUrl"):
                        asset_url = si.get("imageUrl")
                        is_video_asset = False
                        break
                        
            # Fallback search if no asset is selected
            if not asset_url and visual_prompt:
                print(f"No asset selected for scene {scene_num}. Searching stock videos...")
                videos = search_pexels_videos(visual_prompt)
                if videos:
                    asset_url = videos[0].get("videoUrl")
                    is_video_asset = True
                else:
                    print(f"No stock videos found. Searching stock photos...")
                    photos = search_pexels_photos(visual_prompt)
                    if photos:
                        asset_url = photos[0].get("imageUrl")
                        is_video_asset = False
            
            # Step 4: Load visual asset into MoviePy
            clip = None
            if asset_url:
                try:
                    suffix = ".mp4" if is_video_asset else ".jpg"
                    temp_path = download_file(asset_url, suffix)
                    temp_files.append(temp_path)
                    
                    if is_video_asset:
                        video_file = VideoFileClip(temp_path)
                        # Crop or loop video clip to match audio duration
                        if video_file.duration < duration:
                            # Simple loop by concatenating
                            n_repeats = int(duration / video_file.duration) + 1
                            video_loop = [video_file] * n_repeats
                            clip = concatenate_videoclips(video_loop).with_duration(duration)
                        else:
                            clip = video_file.with_duration(duration)
                    else:
                        clip = ImageClip(temp_path).with_duration(duration)
                except Exception as ve:
                    print(f"Failed to load downloaded asset: {ve}. Creating fallback clip.")
                    clip = None
                    
            if clip is None:
                # Create flat gray ColorClip fallback
                clip = ColorClip(size=(target_w, target_h), color=(30, 30, 30)).with_duration(duration)
                
            # Step 5: Aspect ratio adjustment (crop & resize)
            w, h = clip.size
            src_ratio = w / h
            try:
                if src_ratio > target_ratio:
                    # Source is wider than target -> crop left/right
                    new_w = int(h * target_ratio)
                    x_center = w / 2
                    clip = clip.cropped(x1=int(x_center - new_w / 2), y1=0, x2=int(x_center + new_w / 2), y2=h)
                else:
                    # Source is taller than target -> crop top/bottom
                    new_h = int(w / target_ratio)
                    y_center = h / 2
                    clip = clip.cropped(x1=0, y1=int(y_center - new_h / 2), x2=w, y2=int(y_center + new_h / 2))
                
                clip = clip.resized(new_size=(target_w, target_h))
            except Exception as ce:
                print(f"Crop/resize failed: {ce}")
                
            # Step 6: Apply Audio Track
            if audio_clip:
                clip = clip.with_audio(audio_clip)
                
            scene_clips.append(clip)
            
        # Step 7: Concatenate scenes and render
        self.update_state(state='PROGRESS', meta={'progress': 85})
        print("Concatenating scenes...")
        final_clip = concatenate_videoclips(scene_clips, method="compose")
        
        # Output directory setup
        static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
        os.makedirs(static_dir, exist_ok=True)
        output_filename = f"{self.request.id}.mp4"
        output_path = os.path.join(static_dir, output_filename)
        
        print(f"Rendering final output to {output_path}...")
        final_clip.write_videofile(
            output_path,
            fps=24,
            codec="libx264",
            audio_codec="aac",
            threads=2,
            logger=None
        )
        
        # Cleanup
        final_clip.close()
        for c in scene_clips:
            c.close()
            
        return {
            "status": "complete",
            "progress": 100,
            "videoUrl": f"http://127.0.0.1:8003/static/{output_filename}"
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        self.update_state(state='FAILURE', meta={'progress': 100, 'error': str(e)})
        return {"status": "failed", "progress": 0, "error": str(e)}
        
    finally:
        # Delete temporary files
        for f in temp_files:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception as cle:
                    print(f"Failed to delete temp file {f}: {cle}")
