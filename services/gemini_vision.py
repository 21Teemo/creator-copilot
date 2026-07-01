import json
import os
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv
from pydantic import BaseModel

_env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_VISION_MODEL = os.getenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


class GradingOutput(BaseModel):
    ctrScore: int
    feedback: str


def is_gemini_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _vision_model():
    if not GEMINI_API_KEY:
        return None
    return genai.GenerativeModel(GEMINI_VISION_MODEL)


def analyze_image(prompt: str, image_part: dict) -> str:
    model = _vision_model()
    if not model:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    response = model.generate_content([prompt, image_part])
    return (response.text or "").strip()


_REFERENCE_CATEGORY_PROMPTS = {
    "environment": (
        "Describe this image as a production reference for ENVIRONMENT/SETTING. "
        "Include location, architecture, lighting, color palette, time of day, and mood. "
        "Be specific and concise (max 100 words). Plain text only."
    ),
    "character": (
        "Describe this image as a production reference for CHARACTER APPEARANCE. "
        "Include age range, presentation, hair, wardrobe, skin tone, and distinguishing features. "
        "Be specific and concise (max 100 words). Plain text only."
    ),
    "gadget": (
        "Describe this image as a production reference for GADGET/PROP. "
        "Include object type, color, material, size, and distinguishing details. "
        "Be specific and concise (max 80 words). Plain text only."
    ),
}


def analyze_reference_image(category: str, label: str, image_part: dict) -> str:
    cat = (category or "character").strip().lower()
    if cat == "gadgets":
        cat = "gadget"
    prompt = _REFERENCE_CATEGORY_PROMPTS.get(cat, _REFERENCE_CATEGORY_PROMPTS["character"])
    if label.strip():
        prompt += f" User label for context: {label.strip()}"
    return analyze_image(prompt, image_part)


def grade_image(prompt: str, image_part: dict) -> dict:
    model = _vision_model()
    if not model:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    response = model.generate_content(
        [
            f"Analyze this thumbnail design against the target video concept/prompt: '{prompt}'. "
            f"Grade its estimated Click-Through Rate (CTR) potential and provide constructive criticism.",
            image_part,
        ],
        generation_config={
            "response_mime_type": "application/json",
            "response_schema": GradingOutput,
        },
    )
    return json.loads(response.text)
