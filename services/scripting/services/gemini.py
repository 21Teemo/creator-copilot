import json
import re
import httpx
from typing import List
from pydantic import BaseModel

from deepseek_client import chat_json, is_configured
from gemini_vision import grade_image, is_gemini_configured

_METADATA_MARKERS = (
    "=== TRENDING VIDEO ===",
    "=== RESEARCH BRIEF",
    "=== VISUAL FORMAT",
    "=== VISUAL STYLE",
    "=== INSTRUCTIONS ===",
    "Creator Brief:",
    "Video URL:",
    "Citations:",
    "Visual reference:",
    "Enable DEEPSEEK",
    "DEEPSEEK_API_KEY",
)

_METADATA_LINE = re.compile(
    r"^(title|channel|views|duration|description|video url|visual style|visual reference|"
    r"why it'?s trending|citations?)\s*:",
    re.IGNORECASE,
)


class OutlineItem(BaseModel):
    sectionTitle: str
    durationSeconds: int
    talkingPoints: List[str]


class StoryboardItem(BaseModel):
    sceneNumber: int
    visualPrompt: str
    narrationText: str


class StoryboardOutput(BaseModel):
    script: str
    outline: List[OutlineItem]
    storyboard: List[StoryboardItem]


class GradingOutput(BaseModel):
    ctrScore: int
    feedback: str


def extract_topic(prompt: str) -> str:
    match = re.search(r"^Title:\s*(.+)$", prompt, re.MULTILINE | re.IGNORECASE)
    if match:
        title = re.sub(r"#\w+", "", match.group(1)).strip()
        title = re.sub(r"@\w+", "", title).strip()
        if title:
            return title[:120]
    match = re.search(r"^TOPIC:\s*(.+)$", prompt, re.MULTILINE | re.IGNORECASE)
    if match:
        return match.group(1).strip()[:120]
    cleaned = prompt.strip()
    if cleaned and len(cleaned) < 80 and "===" not in cleaned:
        return cleaned
    return "the video topic"


def _truncate_at_markers(text: str) -> str:
    if not text:
        return ""
    earliest = len(text)
    upper = text.upper()
    for marker in _METADATA_MARKERS:
        idx = upper.find(marker.upper())
        if idx > 0:
            earliest = min(earliest, idx)
    return text[:earliest].strip()


def _is_contaminated(text: str) -> bool:
    if not text:
        return True
    if len(text) > 280:
        return True
    if "===" in text or "http://" in text or "https://" in text:
        return True
    if re.search(r"#\w+", text) and re.search(r"@\w+", text):
        return True
    if re.search(r"\b(title|channel|views|duration|description)\s*:", text, re.I):
        return True
    if "DEEPSEEK" in text.upper() and "API" in text.upper():
        return True
    if "research brief" in text.lower() or "trending video" in text.lower():
        return True
    return False


def sanitize_narration(text: str, max_len: int = 600) -> str:
    text = _truncate_at_markers(text or "")
    lines: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        if _METADATA_LINE.match(stripped):
            continue
        if "===" in stripped:
            continue
        if re.search(r"https?://", stripped):
            continue
        if stripped.lower().startswith(
            ("welcome to this video about", "topic:", "research summary:", "creator brief:", "task:")
        ):
            continue
        lines.append(stripped)

    result = " ".join(lines) if len(lines) <= 2 else "\n".join(lines)
    result = re.sub(r"\s{2,}", " ", result).strip()
    if len(result) > max_len:
        cut = result[:max_len]
        if "." in cut:
            result = cut.rsplit(".", 1)[0] + "."
        else:
            result = cut.rstrip() + "…"
    return result


def sanitize_visual_prompt(
    text: str, topic: str = "", visual_style: str = "", content_format: str = "long", max_len: int = 220
) -> str:
    text = _truncate_at_markers(text or "")
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"#\w+", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"\s{2,}", " ", text).strip(" ,;")

    if _is_contaminated(text):
        text = ""

    if text and len(text) > max_len:
        parts = re.split(r"[.!?]\s+", text)
        text = parts[0].strip()
        if text and not text.endswith((".", "!", "?")):
            text += "."

    if not text or len(text) < 12:
        style_hint = ""
        if visual_style and not _is_contaminated(visual_style):
            style_hint = _truncate_at_markers(visual_style)[:80]
        topic_bit = topic[:60] if topic else "the topic"
        framing = "vertical 9:16 framing" if content_format == "short" else "widescreen 16:9 framing"
        base = f"Cinematic scene illustrating {topic_bit}, clear subject and environment"
        if style_hint:
            return f"{base}, {style_hint}, {framing}"[:max_len]
        return f"{base}, dynamic lighting, {framing}"[:max_len]

    return text[:max_len]


def _extract_visual_style_from_prompt(prompt: str) -> str:
    match = re.search(
        r"VISUAL STYLE[^\n]*\n([\s\S]*?)(?:\n\n(?:TASK|RESEARCH|TOPIC)|$)",
        prompt,
        re.IGNORECASE,
    )
    return match.group(1).strip()[:400] if match else ""


def format_visual_references(refs: list | None) -> str:
    if not refs:
        return ""
    lines = [
        "VISUAL REFERENCE LOCK — the SAME elements must appear in EVERY scene visualPrompt:"
    ]
    for ref in refs:
        category = (ref.get("category") or "character").strip()
        label = (ref.get("label") or "").strip()
        if label:
            lines.append(f"- {category.title()}: {label}")
    if len(lines) == 1:
        return ""
    lines.append(
        "Repeat these environment/character/gadget details in each visualPrompt so all scenes stay visually consistent."
    )
    return "\n".join(lines)


def reference_keyword_suffix(refs: list | None) -> str:
    if not refs:
        return ""
    labels = [(ref.get("label") or "").strip() for ref in refs]
    labels = [l for l in labels if l]
    return ", ".join(labels)


def apply_reference_lock(visual_prompt: str, refs: list | None, max_len: int = 220) -> str:
    suffix = reference_keyword_suffix(refs)
    if not suffix:
        return visual_prompt
    if suffix.lower() in visual_prompt.lower():
        return visual_prompt[:max_len]
    combined = f"{visual_prompt}, {suffix}"
    return combined[:max_len]


def build_storyboard_context(
    topic: str,
    creative_angle: str,
    visual_style_notes: str,
    user_task: str,
    visual_references: list | None = None,
) -> str:
    parts = [f"TOPIC: {topic}"]
    ref_block = format_visual_references(visual_references)
    if ref_block:
        parts.append(ref_block)
    if creative_angle.strip():
        parts.append(
            "CREATIVE ANGLE (hooks/pacing only — for your understanding, never paste into outputs):\n"
            + creative_angle.strip()
        )
    if visual_style_notes.strip():
        parts.append(
            "VISUAL STYLE (apply to visualPrompt fields only):\n" + visual_style_notes.strip()
        )
    parts.append(f"TASK: {user_task}")
    return "\n\n".join(parts)


def normalize_storyboard_output(
    result: dict,
    source_prompt: str,
    content_format: str = "long",
    topic: str = "",
    visual_style: str = "",
    visual_references: list | None = None,
) -> dict:
    topic = topic or extract_topic(source_prompt)
    if not visual_style:
        visual_style = _extract_visual_style_from_prompt(source_prompt)

    storyboard = result.get("storyboard") or []
    normalized = []
    for scene in storyboard:
        visual = sanitize_visual_prompt(
            scene.get("visualPrompt", ""),
            topic=topic,
            visual_style=visual_style,
            content_format=content_format,
        )
        visual = apply_reference_lock(visual, visual_references)
        narration = sanitize_narration(scene.get("narrationText", ""))
        normalized.append(
            {
                "sceneNumber": scene.get("sceneNumber", len(normalized) + 1),
                "visualPrompt": visual,
                "narrationText": narration,
            }
        )

    script = result.get("script") or ""
    if _is_contaminated(script) or script.lower().startswith("welcome to this video about"):
        script = " ".join(s["narrationText"] for s in normalized if s.get("narrationText")).strip()

    result["storyboard"] = normalized
    result["script"] = script or sanitize_narration(result.get("script", ""))
    return result


def strip_hashtags(text: str) -> str:
    return re.sub(r"#\w+", "", text).replace("@", "").strip()


def _mock_storyboard(topic: str, content_format: str, visual_references: list | None = None) -> dict:
    topic = strip_hashtags(topic) if topic else "the video topic"
    is_short = content_format == "short"
    framing = "vertical 9:16 handheld shot" if is_short else "widescreen 16:9 cinematic shot"

    def _vp(base: str) -> str:
        return apply_reference_lock(base, visual_references)

    if re.search(r"gym|fitness|workout", topic, re.I):
        scenes = [
            {
                "sceneNumber": 1,
                "visualPrompt": _vp(f"Two friends laughing while walking into a bright modern gym, motivational energy, {framing}, natural window light"),
                "narrationText": "The best gym sessions start with the right partner — someone who shows up when you don't feel like it.",
            },
            {
                "sceneNumber": 2,
                "visualPrompt": _vp(f"Close-up of friends spotting each other on bench press, sweat and determination, shallow depth of field, {framing}"),
                "narrationText": "This trend is simple: grab your friend, hit the gym, and make consistency contagious.",
            },
            {
                "sceneNumber": 3,
                "visualPrompt": _vp(f"Slow-motion high-five after a finished workout set, golden hour gym lighting, {framing}"),
                "narrationText": "Small wins stack fast when accountability is built in. Tag your gym buddy and run it back tomorrow.",
            },
        ]
    else:
        scenes = [
            {
                "sceneNumber": 1,
                "visualPrompt": _vp(f"Engaging opening hook scene about {topic[:50]}, bold subject in focus, {framing}, cinematic lighting"),
                "narrationText": f"Let's break down what's working in {topic} — and how you can use it in your next video.",
            },
            {
                "sceneNumber": 2,
                "visualPrompt": _vp(f"Mid-video demonstration scene illustrating the core idea of {topic[:50]}, clean composition, {framing}"),
                "narrationText": "The angle that performs is specific, visual, and easy to repeat without copying the original.",
            },
            {
                "sceneNumber": 3,
                "visualPrompt": _vp(f"Strong closing call-to-action visual for {topic[:50]}, confident presenter energy, {framing}"),
                "narrationText": "Try one of these hooks this week, measure retention, and double down on what lands.",
            },
        ]

    script = "\n\n".join(s["narrationText"] for s in scenes)
    return {
        "script": script,
        "outline": [
            {
                "sectionTitle": "Hook",
                "durationSeconds": 8 if is_short else 20,
                "talkingPoints": ["Open with the trend's core appeal", "Name the target viewer"],
            },
            {
                "sectionTitle": "Core insight",
                "durationSeconds": 15 if is_short else 45,
                "talkingPoints": ["Explain why the format works", "Give a repeatable creator angle"],
            },
            {
                "sectionTitle": "CTA",
                "durationSeconds": 7 if is_short else 15,
                "talkingPoints": ["Invite the viewer to act", "Reinforce the main takeaway"],
            },
        ],
        "storyboard": scenes,
    }


_STORYBOARD_SYSTEM_RULES = """You are a storyboard prompt engineer for AI image generation.

The user already has a full research brief in another step. Your ONLY job here is to plan scenes for stock/AI image search.

STRICT OUTPUT RULES:
1. "storyboard[].visualPrompt" = standalone image-generation prompt (max ~200 chars). Include: subject, action, environment, lighting, camera/framing. NEVER include voiceover, metadata, URLs, hashtags, stats, or research text.
2. "storyboard[].narrationText" = 1-2 short spoken sentences for that scene only. No metadata.
3. "script" = all narration lines joined — spoken words only, no metadata.
4. Do NOT repeat, quote, or paraphrase the research brief in visualPrompt. Translate the topic into concrete visual scenes.
5. Generate 3-5 scenes. Match visual style notes in visualPrompt when provided.
6. If VISUAL REFERENCE LOCK is provided, every visualPrompt MUST include those same environment, character, and gadget descriptions.

Return JSON with keys: script (string), outline (array of {sectionTitle, durationSeconds, talkingPoints}), storyboard (array of {sceneNumber, visualPrompt, narrationText})."""


def generate_storyboard(
    prompt: str = "",
    content_format: str = "long",
    topic: str = "",
    creative_angle: str = "",
    visual_style_notes: str = "",
    visual_references: list | None = None,
) -> dict:
    effective_topic = strip_hashtags(topic) if topic else extract_topic(prompt)
    user_task = (prompt or "").strip() or (
        "Plan scene image prompts for the topic. Each visualPrompt must work as a standalone image search query."
    )
    context = build_storyboard_context(
        effective_topic,
        creative_angle,
        visual_style_notes,
        user_task,
        visual_references=visual_references,
    )

    if not is_configured():
        mock = _mock_storyboard(effective_topic, content_format, visual_references)
        return normalize_storyboard_output(
            mock, context, content_format, topic=effective_topic, visual_style=visual_style_notes,
            visual_references=visual_references,
        )

    try:
        format_instruction = (
            "YouTube Short (under 60s, vertical 9:16)"
            if content_format == "short"
            else "standard long-form YouTube video (16:9)"
        )
        result = chat_json(
            f"{_STORYBOARD_SYSTEM_RULES}\n\nFormat: {format_instruction}\n\nContext:\n{context}",
            system_prompt="You output structured storyboard JSON for video production.",
            temperature=0.5,
        )
        return normalize_storyboard_output(
            result, context, content_format, topic=effective_topic, visual_style=visual_style_notes,
            visual_references=visual_references,
        )
    except Exception as e:
        print(f"Storyboard generation failed: {e}")
        return {
            "script": f"An error occurred generating script: {str(e)}",
            "outline": [],
            "storyboard": [],
        }


def load_image_data(image_url: str):
    import base64

    if image_url.startswith("data:image/"):
        header, encoded = image_url.split(",", 1)
        mime_type = header.split(";")[0].split(":")[1]
        data = base64.b64decode(encoded)
        return {"mime_type": mime_type, "data": data}
    with httpx.Client() as client:
        res = client.get(image_url)
        res.raise_for_status()
        content_type = res.headers.get("content-type", "image/jpeg")
        mime_type = content_type.split(";")[0]
        return {"mime_type": mime_type, "data": res.content}


def grade_thumbnail(prompt: str, image_url: str) -> dict:
    if not is_gemini_configured():
        return {
            "ctrScore": 78,
            "feedback": f"The thumbnail shows strong contrast and matches your prompt '{prompt}' nicely. Try enhancing neon glows in the text overlay to improve CTR.",
        }

    try:
        image_part = load_image_data(image_url)
        return grade_image(prompt, image_part)
    except Exception as e:
        print(f"Thumbnail grading failed: {e}")
        return {
            "ctrScore": 50,
            "feedback": f"Failed to grade thumbnail. Error: {str(e)}",
        }
