import base64
import os
import re
import uuid

from google import genai

from media.config import GEMINI_API_KEY, GEMINI_IMAGE_MODEL
from media.services.stock import enrich_stock_query

ASPECT_RATIOS = {
    "short": "9:16",
    "long": "16:9",
}


def _gemini_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=GEMINI_API_KEY)


def _build_generation_prompt(prompt: str, visual_references: list | None, content_format: str = "long") -> str:
    enriched = enrich_stock_query(prompt, visual_references)
    aspect_ratio = ASPECT_RATIOS.get(content_format, ASPECT_RATIOS["long"])
    return (
        f"{enriched}. Aspect ratio {aspect_ratio}. Cinematic lighting, sharp focus, photorealistic, "
        "no text overlays, no watermarks."
    )[:500]


def _load_image_bytes(image_url: str, project_id: str, static_dir: str) -> tuple[bytes, str]:
    if image_url.startswith("data:image/"):
        header, encoded = image_url.split(",", 1)
        mime_type = header.split(";")[0].split(":")[1]
        return base64.b64decode(encoded), mime_type

    if image_url.startswith("/api/v1/projects/"):
        rel = re.sub(r"^/api/v1/projects/[^/]+/media/static/", "", image_url)
        full_path = os.path.join(static_dir, rel)
        if os.path.isfile(full_path):
            with open(full_path, "rb") as handle:
                return handle.read(), "image/jpeg"

    import httpx

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "image/*,*/*;q=0.8",
    }
    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        res = client.get(image_url, headers=headers)
        res.raise_for_status()
        content_type = res.headers.get("content-type", "image/jpeg").split(";")[0]
        mime_type = content_type if content_type.startswith("image/") else "image/jpeg"
        return res.content, mime_type


def save_generated_asset(
    content: bytes,
    filename: str,
    project_id: str,
    static_dir: str,
) -> str:
    safe_name = f"{uuid.uuid4().hex}_{filename}"
    rel_path = f"generated/{project_id}/{safe_name}"
    full_path = os.path.join(static_dir, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as handle:
        handle.write(content)
    return f"/api/v1/projects/{project_id}/media/static/{rel_path}"


def _build_interaction_input(
    prompt: str,
    visual_references: list | None,
    project_id: str,
    static_dir: str,
) -> list | str:
    refs = visual_references or []
    ref_images = [
        ref for ref in refs if (ref.get("imageUrl") or "").strip()
    ][:3]

    if not ref_images:
        return prompt

    parts: list[dict] = [{"type": "text", "text": prompt}]
    for ref in ref_images:
        label = (ref.get("label") or ref.get("category") or "reference").strip()
        image_bytes, mime_type = _load_image_bytes(ref["imageUrl"], project_id, static_dir)
        parts.append(
            {
                "type": "text",
                "text": f"Use this {ref.get('category', 'reference')} reference ({label}) for visual consistency.",
            }
        )
        parts.append(
            {
                "type": "image",
                "data": base64.b64encode(image_bytes).decode("utf-8"),
                "mime_type": mime_type,
            }
        )
    return parts


def generate_scene_image(
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

    interaction = client.interactions.create(
        model=GEMINI_IMAGE_MODEL,
        input=_build_interaction_input(generation_prompt, visual_references, project_id, static_dir),
        response_format={
            "type": "image",
            "mime_type": "image/jpeg",
            "aspect_ratio": aspect_ratio,
        },
    )

    output_image = interaction.output_image
    if not output_image or not output_image.data:
        raise RuntimeError("Gemini returned no scene image")

    image_bytes = base64.b64decode(output_image.data)
    scene_suffix = scene_number or 1
    image_url = save_generated_asset(
        image_bytes,
        f"scene-{scene_suffix}.jpg",
        project_id,
        static_dir,
    )

    return {
        "imageUrl": image_url,
        "visualPrompt": generation_prompt,
        "source": "gemini-nano-banana",
    }
