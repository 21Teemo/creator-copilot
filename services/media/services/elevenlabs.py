import re

import httpx
from gtts import gTTS

from media.config import (
    ELEVEN_LABS_API_KEY,
    ELEVEN_LABS_MODEL_ID,
    ELEVEN_LABS_OUTPUT_FORMAT,
    ELEVEN_LABS_SIMILARITY_BOOST,
    ELEVEN_LABS_SPEED,
    ELEVEN_LABS_STABILITY,
    ELEVEN_LABS_STYLE,
    ELEVEN_LABS_VOICE_ID,
)


def _is_placeholder_key() -> bool:
    if not ELEVEN_LABS_API_KEY:
        return True
    lowered = ELEVEN_LABS_API_KEY.lower()
    return ELEVEN_LABS_API_KEY.startswith("YOUR_") or "placeholder" in lowered


def prepare_narration_for_tts(text: str) -> str:
    """Light cleanup so TTS gets natural pacing and emphasis."""
    cleaned = (text or "").strip()
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    cleaned = re.sub(r"[@#]\w+", "", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    cleaned = cleaned.replace("—", ", ").replace("–", ", ")

    if not cleaned:
        return ""

    # Short punchy lines benefit from a trailing beat; questions keep their mark.
    if cleaned[-1] not in ".!?":
        cleaned = f"{cleaned}."

    return cleaned


def generate_voiceover(
    text: str,
    output_path: str,
    *,
    previous_text: str | None = None,
    next_text: str | None = None,
    previous_request_ids: list[str] | None = None,
) -> tuple[bool, str | None]:
    """
    Generate scene narration audio.
    Returns (success, request_id) — request_id enables prosody stitching across scenes.
    """
    speech_text = prepare_narration_for_tts(text)
    if not speech_text:
        return False, None

    if _is_placeholder_key():
        print("Using gTTS fallback for voiceover generation...")
        return _gtts_fallback(speech_text, output_path), None

    url = (
        f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_LABS_VOICE_ID}"
        f"?output_format={ELEVEN_LABS_OUTPUT_FORMAT}"
    )
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVEN_LABS_API_KEY,
    }

    payload: dict = {
        "text": speech_text,
        "model_id": ELEVEN_LABS_MODEL_ID,
        "voice_settings": {
            "stability": ELEVEN_LABS_STABILITY,
            "similarity_boost": ELEVEN_LABS_SIMILARITY_BOOST,
            "style": ELEVEN_LABS_STYLE,
            "use_speaker_boost": True,
            "speed": ELEVEN_LABS_SPEED,
        },
    }

    if previous_text:
        payload["previous_text"] = prepare_narration_for_tts(previous_text)[:500]
    if next_text:
        payload["next_text"] = prepare_narration_for_tts(next_text)[:500]
    if previous_request_ids:
        payload["previous_request_ids"] = previous_request_ids[-3:]

    try:
        with httpx.Client() as client:
            res = client.post(url, json=payload, headers=headers, timeout=120.0)
            if res.status_code == 200:
                with open(output_path, "wb") as handle:
                    handle.write(res.content)
                request_id = res.headers.get("request-id")
                return True, request_id

            print(
                f"ElevenLabs API failed ({res.status_code}): {res.text[:300]}. "
                "Falling back to gTTS..."
            )
            return _gtts_fallback(speech_text, output_path), None
    except Exception as exc:
        print(f"ElevenLabs request exception: {exc}. Falling back to gTTS...")
        return _gtts_fallback(speech_text, output_path), None


def _gtts_fallback(text: str, output_path: str) -> bool:
    try:
        tts = gTTS(text=text, lang="en")
        tts.save(output_path)
        return True
    except Exception as exc:
        print(f"gTTS fallback failed: {exc}")
        return False
