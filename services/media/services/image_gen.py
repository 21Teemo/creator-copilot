import base64
import os
import re
import httpx

from media.config import REPLICATE_API_TOKEN
from media.services.stock import enrich_stock_query, search_pexels_photos

PULID_MODEL = "bytedance/flux-pulid"
KONTEXT_MODEL = "black-forest-labs/flux-kontext-dev"

ASPECT_SIZES = {
    "short": (768, 1344),
    "long": (1344, 768),
}


def has_reference_images(visual_references: list | None) -> bool:
    if not visual_references:
        return False
    return any((ref.get("imageUrl") or "").strip() for ref in visual_references)


def _pick_reference(visual_references: list | None, category: str) -> dict | None:
    if not visual_references:
        return None
    for ref in visual_references:
        if ref.get("category") == category and (ref.get("imageUrl") or "").strip():
            return ref
    return None


def _build_generation_prompt(prompt: str, visual_references: list | None) -> str:
    enriched = enrich_stock_query(prompt, visual_references)
    return (
        f"{enriched}. Cinematic lighting, sharp focus, photorealistic, no text overlays, no watermarks."
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


def _upload_replicate_file(image_bytes: bytes, mime_type: str) -> str:
    ext = mime_type.split("/")[-1] if "/" in mime_type else "jpg"
    if ext == "jpeg":
        ext = "jpg"
    filename = f"reference.{ext}"

    with httpx.Client(timeout=60.0) as client:
        res = client.post(
            "https://api.replicate.com/v1/files",
            headers={"Authorization": f"Bearer {REPLICATE_API_TOKEN}"},
            files={"content": (filename, image_bytes, mime_type or "application/octet-stream")},
        )
        res.raise_for_status()
        payload = res.json()
        url = payload.get("urls", {}).get("get")
        if not url:
            raise RuntimeError("Replicate file upload did not return a URL")
        return url


def _resolve_replicate_image_url(image_url: str, project_id: str, static_dir: str) -> str:
    trimmed = (image_url or "").strip()
    if not trimmed:
        raise ValueError("Reference image URL is empty")

    if trimmed.startswith("http://127.0.0.1") or trimmed.startswith("http://localhost"):
        image_bytes, mime_type = _load_image_bytes(trimmed, project_id, static_dir)
        return _upload_replicate_file(image_bytes, mime_type)

    if trimmed.startswith("http://") or trimmed.startswith("https://"):
        return trimmed

    image_bytes, mime_type = _load_image_bytes(trimmed, project_id, static_dir)
    return _upload_replicate_file(image_bytes, mime_type)


def _run_replicate_model(model: str, model_input: dict) -> str:
    with httpx.Client(timeout=300.0) as client:
        create = client.post(
            f"https://api.replicate.com/v1/models/{model}/predictions",
            headers={
                "Authorization": f"Bearer {REPLICATE_API_TOKEN}",
                "Content-Type": "application/json",
                "Prefer": "wait",
            },
            json={"input": model_input},
        )
        create.raise_for_status()
        prediction = create.json()

        status = prediction.get("status")
        if status == "succeeded":
            return _extract_output_url(prediction.get("output"))

        if status in {"starting", "processing", "queued"}:
            poll_url = prediction.get("urls", {}).get("get")
            if not poll_url:
                raise RuntimeError(f"Replicate prediction stuck in {status}")
            for _ in range(120):
                poll = client.get(
                    poll_url,
                    headers={"Authorization": f"Bearer {REPLICATE_API_TOKEN}"},
                )
                poll.raise_for_status()
                prediction = poll.json()
                status = prediction.get("status")
                if status == "succeeded":
                    return _extract_output_url(prediction.get("output"))
                if status in {"failed", "canceled"}:
                    break
            raise RuntimeError(prediction.get("error") or f"Replicate prediction {status}")

        raise RuntimeError(prediction.get("error") or f"Replicate prediction {status}")


def _extract_output_url(output) -> str:
    if isinstance(output, str):
        return output
    if isinstance(output, list) and output:
        first = output[0]
        if isinstance(first, str):
            return first
    raise RuntimeError("Replicate returned no image URL")


def _generate_with_pulid(
    prompt: str,
    character_ref: dict,
    content_format: str,
    project_id: str,
    static_dir: str,
) -> str:
    width, height = ASPECT_SIZES.get(content_format, ASPECT_SIZES["long"])
    main_face_image = _resolve_replicate_image_url(character_ref["imageUrl"], project_id, static_dir)
    return _run_replicate_model(
        PULID_MODEL,
        {
            "prompt": prompt,
            "main_face_image": main_face_image,
            "width": width,
            "height": height,
            "id_weight": 1.0,
            "start_step": 4,
            "num_steps": 20,
            "guidance_scale": 4,
            "output_format": "jpg",
            "output_quality": 90,
            "num_outputs": 1,
            "negative_prompt": (
                "bad quality, worst quality, text, signature, watermark, extra limbs, "
                "deformed eyes, blurry, low resolution"
            ),
        },
    )


def _generate_with_kontext(
    prompt: str,
    reference_ref: dict,
    content_format: str,
    project_id: str,
    static_dir: str,
) -> str:
    input_image = _resolve_replicate_image_url(reference_ref["imageUrl"], project_id, static_dir)
    aspect_ratio = "9:16" if content_format == "short" else "16:9"
    kontext_prompt = (
        f"Recreate this scene with the same subject, props, and environment style. {prompt}"
    )
    return _run_replicate_model(
        KONTEXT_MODEL,
        {
            "prompt": kontext_prompt[:500],
            "input_image": input_image,
            "aspect_ratio": aspect_ratio,
            "guidance": 2.5,
            "num_inference_steps": 28,
            "output_format": "jpg",
            "output_quality": 90,
            "go_fast": True,
        },
    )


def generate_scene_image(
    prompt: str,
    visual_references: list | None,
    content_format: str = "long",
    project_id: str = "default",
    static_dir: str | None = None,
) -> dict:
    refs = visual_references or []
    generation_prompt = _build_generation_prompt(prompt, refs)
    static_dir = static_dir or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")

    if REPLICATE_API_TOKEN and has_reference_images(refs):
        try:
            character_ref = _pick_reference(refs, "character")
            if character_ref:
                image_url = _generate_with_pulid(
                    generation_prompt,
                    character_ref,
                    content_format,
                    project_id,
                    static_dir,
                )
                return {
                    "imageUrl": image_url,
                    "visualPrompt": generation_prompt,
                    "source": "flux-pulid",
                }

            env_ref = _pick_reference(refs, "environment") or _pick_reference(refs, "gadget")
            if env_ref:
                image_url = _generate_with_kontext(
                    generation_prompt,
                    env_ref,
                    content_format,
                    project_id,
                    static_dir,
                )
                return {
                    "imageUrl": image_url,
                    "visualPrompt": generation_prompt,
                    "source": "flux-kontext",
                }
        except Exception as exc:
            print(f"FLUX generation failed, falling back to stock: {exc}")

    stock = search_pexels_photos(generation_prompt, visual_references=refs)
    if stock:
        first = stock[0]
        return {
            "imageUrl": first["imageUrl"],
            "visualPrompt": first.get("visualPrompt") or generation_prompt,
            "source": "stock",
        }

    return {
        "imageUrl": "",
        "visualPrompt": generation_prompt,
        "source": "none",
    }
