import os
import time

from google import genai
from google.genai import types

from media.config import GEMINI_API_KEY, GEMINI_VIDEO_MODEL
from media.services.image_gen import ASPECT_RATIOS, _build_generation_prompt, save_generated_asset

POLL_INTERVAL_SECONDS = 10
MAX_POLL_ATTEMPTS = 60


def _gemini_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=GEMINI_API_KEY)


def generate_scene_video(
    prompt: str,
    visual_references: list | None,
    content_format: str = "long",
    project_id: str = "default",
    static_dir: str | None = None,
    scene_number: int | None = None,
) -> dict:
    static_dir = static_dir or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
    generation_prompt = _build_generation_prompt(prompt, visual_references, content_format)
    aspect_ratio = ASPECT_RATIOS.get(content_format, ASPECT_RATIOS["long"])
    client = _gemini_client()

    operation = client.models.generate_videos(
        model=GEMINI_VIDEO_MODEL,
        prompt=generation_prompt,
        config=types.GenerateVideosConfig(
            aspect_ratio=aspect_ratio,
        ),
    )

    for _ in range(MAX_POLL_ATTEMPTS):
        if operation.done:
            break
        time.sleep(POLL_INTERVAL_SECONDS)
        operation = client.operations.get(operation)

    if not operation.done:
        raise RuntimeError("Gemini video generation timed out")

    if not operation.response or not operation.response.generated_videos:
        error = getattr(operation, "error", None)
        raise RuntimeError(str(error) if error else "Gemini returned no scene video")

    generated_video = operation.response.generated_videos[0]
    client.files.download(file=generated_video.video)

    video_bytes = generated_video.video.video_bytes
    if not video_bytes:
        raise RuntimeError("Gemini video download returned no bytes")

    scene_suffix = scene_number or 1
    video_url = save_generated_asset(
        video_bytes,
        f"scene-{scene_suffix}.mp4",
        project_id,
        static_dir,
    )

    return {
        "videoUrl": video_url,
        "visualPrompt": generation_prompt,
        "source": "gemini-veo",
    }
