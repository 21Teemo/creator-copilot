import base64
import json
import os
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import httpx
from dotenv import load_dotenv

_env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_env_path)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_API_BASE = os.getenv("DEEPSEEK_API_BASE", "https://api.deepseek.com").rstrip("/")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_VISION_MODEL = os.getenv("DEEPSEEK_VISION_MODEL", DEEPSEEK_MODEL)


def is_configured() -> bool:
    return bool(DEEPSEEK_API_KEY)


def _post_chat(payload: dict[str, Any]) -> str:
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY is not configured")

    with httpx.Client(timeout=180.0) as client:
        response = client.post(
            f"{DEEPSEEK_API_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        message = data["choices"][0]["message"]
        return (message.get("content") or "").strip()


def chat_text(
    user_prompt: str,
    *,
    system_prompt: str | None = None,
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    messages: list[dict[str, Any]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})
    return _post_chat(
        {
            "model": model or DEEPSEEK_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }
    )


def chat_json(
    user_prompt: str,
    *,
    system_prompt: str | None = None,
    model: str | None = None,
    temperature: float = 0.4,
    max_tokens: int = 4096,
) -> dict[str, Any]:
    messages: list[dict[str, Any]] = []
    system = system_prompt or "You are a helpful assistant."
    system = f"{system}\n\nRespond with valid JSON only. No markdown fences."
    messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user_prompt})
    raw = _post_chat(
        {
            "model": model or DEEPSEEK_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "stream": False,
        }
    )
    return json.loads(raw)


def chat_with_image(
    user_prompt: str,
    *,
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    system_prompt: str | None = None,
    model: str | None = None,
    max_tokens: int = 2048,
) -> str:
    data_url = f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"
    content: list[dict[str, Any]] = [
        {"type": "image_url", "image_url": {"url": data_url}},
        {"type": "text", "text": user_prompt},
    ]
    messages: list[dict[str, Any]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": content})
    return _post_chat(
        {
            "model": model or DEEPSEEK_VISION_MODEL,
            "messages": messages,
            "max_tokens": max_tokens,
            "stream": False,
        }
    )


class LegacyModel:
    """Drop-in replacement for google.generativeai.GenerativeModel.generate_content."""

    def __init__(self, model_name: str | None = None, tools: Any = None):
        self.model_name = model_name or DEEPSEEK_MODEL
        self.tools = tools

    def generate_content(self, content, generation_config=None):
        json_mode = False
        if isinstance(generation_config, dict):
            json_mode = generation_config.get("response_mime_type") == "application/json"

        if isinstance(content, list):
            text_parts: list[str] = []
            image_bytes = None
            mime_type = "image/jpeg"
            for part in content:
                if isinstance(part, str):
                    text_parts.append(part)
                elif isinstance(part, dict) and part.get("data") is not None:
                    image_bytes = part.get("data")
                    mime_type = part.get("mime_type") or mime_type
            prompt = "\n\n".join(text_parts)
            if image_bytes is not None:
                text = chat_with_image(
                    prompt,
                    image_bytes=image_bytes,
                    mime_type=mime_type,
                    model=DEEPSEEK_VISION_MODEL,
                )
            else:
                text = chat_text(prompt, model=self.model_name)
        else:
            prompt = str(content)
            if json_mode:
                parsed = chat_json(prompt, model=self.model_name)
                text = json.dumps(parsed)
            else:
                text = chat_text(prompt, model=self.model_name)

        return SimpleNamespace(text=text)


def get_model(name: str | None = None, use_search: bool = False):
    if not is_configured():
        return None
    return LegacyModel(model_name=name or DEEPSEEK_MODEL)
