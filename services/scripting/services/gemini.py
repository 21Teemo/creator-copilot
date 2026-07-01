import json
import re
import httpx
from typing import List, Optional
from pydantic import BaseModel

from deepseek_client import chat_json, is_configured
from gemini_vision import analyze_reference_image, grade_image, is_gemini_configured

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
    environment: str = ""
    character: str = ""
    gadgets: str = ""


class StoryboardOutput(BaseModel):
    script: str
    outline: List[OutlineItem]
    storyboard: List[StoryboardItem]
    creativeDirective: Optional[str] = None


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


def format_visual_references(
    refs: list | None, anchors: dict[str, str] | None = None
) -> str:
    anchors = anchors or {}
    env = (anchors.get("environment") or "").strip()
    char = (anchors.get("character") or "").strip()
    gadgets = (anchors.get("gadgets") or "").strip()

    if not refs and not any((env, char, gadgets)):
        return ""

    lines = [
        "VISUAL REFERENCE LOCK — copy environment, character, and gadgets IDENTICALLY into "
        "every storyboard scene unless the RESEARCH BRIEF explicitly changes location:"
    ]
    if env:
        lines.append(f"- Environment (identical every scene): {env}")
    if char:
        lines.append(f"- Character (identical every scene): {char}")
    if gadgets:
        lines.append(f"- Gadgets (identical every scene): {gadgets}")

    for ref in refs or []:
        category = (ref.get("category") or "character").strip().lower()
        label = (ref.get("label") or "").strip()
        if not label:
            continue
        key = "gadgets" if category == "gadget" else category
        if key == "environment" and env:
            continue
        if key == "character" and char:
            continue
        if key == "gadgets" and gadgets:
            continue
        lines.append(f"- {category.title()} label: {label}")

    if len(lines) == 1:
        return ""
    lines.append(
        "Set storyboard[].environment, storyboard[].character, and storyboard[].gadgets to these "
        "exact strings on EVERY scene (use \"\" for gadgets when N/A). "
        "visualPrompt = scene-specific action/framing/lighting merged with these anchors — "
        "do not contradict them."
    )
    return "\n".join(lines)


def analyze_visual_references(refs: list | None) -> dict[str, str]:
    """Extract authoritative environment/character/gadgets anchors from reference images or labels."""
    result = {"environment": "", "character": "", "gadgets": ""}
    if not refs:
        return result

    buckets: dict[str, list[str]] = {"environment": [], "character": [], "gadgets": []}
    category_map = {"environment": "environment", "character": "character", "gadget": "gadgets"}

    for ref in refs:
        category = (ref.get("category") or "character").strip().lower()
        bucket = category_map.get(category, "character")
        label = (ref.get("label") or "").strip()
        image_url = (ref.get("imageUrl") or "").strip()

        description = label
        if image_url:
            if is_gemini_configured():
                try:
                    image_part = load_image_data(image_url)
                    vision_desc = analyze_reference_image(category, label, image_part)
                    if vision_desc:
                        description = (
                            f"{label}: {vision_desc}" if label and label.lower() not in vision_desc.lower() else vision_desc
                        )
                except Exception as e:
                    print(f"Visual reference analysis failed ({category}): {e}")
            elif label:
                description = label

        if description:
            buckets[bucket].append(description.strip())

    for key, parts in buckets.items():
        result[key] = "; ".join(parts)[:400]
    return result


def _canonical_reference_fields(
    scenes: list[dict], anchors: dict[str, str]
) -> tuple[str, str, str]:
    env = (anchors.get("environment") or "").strip()
    char = (anchors.get("character") or "").strip()
    gadgets = (anchors.get("gadgets") or "").strip()

    if not env:
        for scene in scenes:
            candidate = (scene.get("environment") or "").strip()
            if candidate:
                env = candidate
                break
    if not char:
        for scene in scenes:
            candidate = (scene.get("character") or "").strip()
            if candidate:
                char = candidate
                break
    if not gadgets:
        for scene in scenes:
            candidate = (scene.get("gadgets") or "").strip()
            if candidate:
                gadgets = candidate
                break
    return env, char, gadgets


def merge_visual_prompt_with_anchors(
    visual: str, environment: str, character: str, gadgets: str, max_len: int
) -> str:
    anchor_parts = [p for p in (environment, character, gadgets) if p]
    if not anchor_parts:
        return visual[:max_len]
    anchor_text = ", ".join(anchor_parts)
    if not visual:
        return anchor_text[:max_len]
    lower = visual.lower()
    if all(part.lower() in lower for part in anchor_parts if len(part) > 8):
        return visual[:max_len]
    combined = f"{visual}, {anchor_text}"
    return combined[:max_len]


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


_VALUE_LENS_DIRECTIVES = {
    "emotional": (
        "Lens A — Emotional Connection: raw vulnerability, silence, tears, sensory intimacy, "
        "feeling over explanation. visualPrompt emphasizes faces, atmosphere, pivotal emotional beats."
    ),
    "educational": (
        "Lens B — Educational / Practical Utility: how-to, step-by-step, history, culture, "
        "behind-the-scenes facts. visualPrompt emphasizes artifacts, demonstrations, informative detail."
    ),
    "interactive": (
        "Lens C — Interactive / Audience Participation: rhetorical questions, direct address, "
        "invitations to choose or comment. narrationText asks the viewer to engage."
    ),
}


def format_value_lens_block(value_lens: str) -> str:
    key = (value_lens or "auto").strip().lower()
    if key == "auto" or key not in _VALUE_LENS_DIRECTIVES:
        return ""
    return (
        "VALUE LENS (USER-SELECTED — skip Phase 2/3 auto-selection; execute ONLY through this lens):\n"
        + _VALUE_LENS_DIRECTIVES[key]
    )


def build_storyboard_context(
    topic: str,
    creative_angle: str,
    visual_style_notes: str,
    user_task: str,
    visual_references: list | None = None,
    research_brief: str = "",
    value_lens: str = "auto",
    reference_anchors: dict[str, str] | None = None,
) -> str:
    parts = [f"TOPIC: {topic}"]
    if research_brief.strip():
        parts.append(
            "RESEARCH BRIEF (AUTHORITATIVE — replicate structure, shot count, pacing, audio format, "
            "emotional arc, visual composition, and audience language from this; do NOT substitute a "
            "generic promo montage):\n"
            + research_brief.strip()[:8000]
        )
    ref_block = format_visual_references(visual_references, reference_anchors)
    if ref_block:
        parts.append(ref_block)
    if creative_angle.strip() and not research_brief.strip():
        parts.append(
            "CREATIVE ANGLE (hooks/pacing only — for your understanding, never paste into outputs):\n"
            + creative_angle.strip()
        )
    if visual_style_notes.strip():
        parts.append(
            "VISUAL STYLE (apply to visualPrompt fields only):\n" + visual_style_notes.strip()
        )
    lens_block = format_value_lens_block(value_lens)
    if lens_block:
        parts.append(lens_block)
    parts.append(f"TASK: {user_task}")
    return "\n\n".join(parts)


def normalize_storyboard_output(
    result: dict,
    source_prompt: str,
    content_format: str = "long",
    topic: str = "",
    visual_style: str = "",
    visual_references: list | None = None,
    storytelling_enabled: bool = False,
    reference_anchors: dict[str, str] | None = None,
) -> dict:
    topic = topic or extract_topic(source_prompt)
    if not visual_style:
        visual_style = _extract_visual_style_from_prompt(source_prompt)

    narration_max = 900 if storytelling_enabled else 600
    script_max = 5000 if storytelling_enabled else 600
    prompt_max = 280 if storytelling_enabled else 220

    anchors = reference_anchors or analyze_visual_references(visual_references)
    raw_storyboard = result.get("storyboard") or []
    env_anchor, char_anchor, gadget_anchor = _canonical_reference_fields(raw_storyboard, anchors)
    has_reference_lock = bool(env_anchor or char_anchor or gadget_anchor)

    normalized = []
    for scene in raw_storyboard:
        environment = env_anchor if has_reference_lock else (scene.get("environment") or "").strip()
        character = char_anchor if has_reference_lock else (scene.get("character") or "").strip()
        gadgets = gadget_anchor if has_reference_lock else (scene.get("gadgets") or "").strip()

        visual = sanitize_visual_prompt(
            scene.get("visualPrompt", ""),
            topic=topic,
            visual_style=visual_style,
            content_format=content_format,
            max_len=prompt_max,
        )
        visual = merge_visual_prompt_with_anchors(
            visual, environment, character, gadgets, max_len=prompt_max
        )
        if not has_reference_lock:
            visual = apply_reference_lock(visual, visual_references, max_len=prompt_max)
        narration = sanitize_narration(scene.get("narrationText", ""), max_len=narration_max)
        normalized.append(
            {
                "sceneNumber": scene.get("sceneNumber", len(normalized) + 1),
                "visualPrompt": visual,
                "narrationText": narration,
                "environment": environment,
                "character": character,
                "gadgets": gadgets,
            }
        )

    script = result.get("script") or ""
    if _is_contaminated(script) or script.lower().startswith("welcome to this video about"):
        script = " ".join(s["narrationText"] for s in normalized if s.get("narrationText")).strip()

    if normalized and not any(s.get("narrationText") for s in normalized):
        script = ""

    result["storyboard"] = normalized
    result["script"] = script or sanitize_narration(result.get("script", ""), max_len=script_max)
    directive = result.get("creativeDirective")
    if isinstance(directive, str) and directive.strip():
        result["creativeDirective"] = directive.strip()[:500]
    else:
        result.pop("creativeDirective", None)
    return result


def strip_hashtags(text: str) -> str:
    return re.sub(r"#\w+", "", text).replace("@", "").strip()


def _mock_storyboard(
    topic: str,
    content_format: str,
    visual_references: list | None = None,
    reference_anchors: dict[str, str] | None = None,
) -> dict:
    topic = strip_hashtags(topic) if topic else "the video topic"
    is_short = content_format == "short"
    framing = "vertical 9:16 handheld shot" if is_short else "widescreen 16:9 cinematic shot"
    anchors = reference_anchors or analyze_visual_references(visual_references)
    env = anchors.get("environment", "")
    char = anchors.get("character", "")
    gadgets = anchors.get("gadgets", "")

    def _scene(scene_number: int, base_vp: str, narration: str) -> dict:
        vp = merge_visual_prompt_with_anchors(base_vp, env, char, gadgets, max_len=220)
        if not (env or char or gadgets):
            vp = apply_reference_lock(vp, visual_references)
        return {
            "sceneNumber": scene_number,
            "environment": env,
            "character": char,
            "gadgets": gadgets,
            "visualPrompt": vp,
            "narrationText": narration,
        }

    if re.search(r"gym|fitness|workout", topic, re.I):
        scenes = [
            _scene(
                1,
                f"Two friends laughing while walking into a bright modern gym, motivational energy, {framing}, natural window light",
                "The best gym sessions start with the right partner — someone who shows up when you don't feel like it.",
            ),
            _scene(
                2,
                f"Close-up of friends spotting each other on bench press, sweat and determination, shallow depth of field, {framing}",
                "This trend is simple: grab your friend, hit the gym, and make consistency contagious.",
            ),
            _scene(
                3,
                f"Slow-motion high-five after a finished workout set, golden hour gym lighting, {framing}",
                "Small wins stack fast when accountability is built in. Tag your gym buddy and run it back tomorrow.",
            ),
        ]
    else:
        scenes = [
            _scene(
                1,
                f"Engaging opening hook scene about {topic[:50]}, bold subject in focus, {framing}, cinematic lighting",
                f"Let's break down what's working in {topic} — and how you can use it in your next video.",
            ),
            _scene(
                2,
                f"Mid-video demonstration scene illustrating the core idea of {topic[:50]}, clean composition, {framing}",
                "The angle that performs is specific, visual, and easy to repeat without copying the original.",
            ),
            _scene(
                3,
                f"Strong closing call-to-action visual for {topic[:50]}, confident presenter energy, {framing}",
                "Try one of these hooks this week, measure retention, and double down on what lands.",
            ),
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


_NARRATION_LOCALIZATION_RULES = """
NARRATION LANGUAGE (infer from context — do not assume English):
1. Determine whether the target audience is primarily English-speaking or not, using all signals in Context: research brief (audience, region, culture), topic/title wording, descriptions, hashtags, country/phone codes, event or place names, and creative_angle.
2. If the audience is NOT primarily English-speaking, identify the most appropriate language for that audience and write the ENTIRE narrationText and script in that language only.
3. If the audience IS primarily English-speaking, write narration in English.
4. Do not mix languages unless the source material clearly code-switches for that audience. Do not write English narration for a clearly non-English local audience.
5. visualPrompt remains in English (image-search keywords). Only spoken narration (narrationText, script) follows the inferred audience language.
6. If the user specifies a language in creative_angle or TASK, that overrides inference.
7. If audience language is genuinely ambiguous with no locale or linguistic signals, use English.
"""


_BRIEF_FIDELITY_RULES = """
RESEARCH BRIEF FIDELITY (highest priority when RESEARCH BRIEF is in Context):
1. Structure: Match the source video's scene count and editing style. Single continuous/static shot with no cuts = ONE storyboard scene. Shot-by-shot sections in the brief = one scene per shot described.
2. Audio: If the brief says no voiceover, ambient/silence only, or emotion conveyed without speech — set narrationText to "" for every scene and script to "" (or a single optional whisper line only if the brief explicitly allows minimal speech).
3. Hook & arc: Preserve the brief's emotional contrast and core hook (e.g. festive visuals vs. grief). Do NOT genericize into promotional celebration montages or marketing copy.
4. visualPrompt: Describe the SPECIFIC shots from the brief — framing, subject, action, lighting, background. Use concrete image-search language. Include pivotal moments (tears, face paint close-up, golden hour MCU, etc.) when the brief names them.
5. Honor VISUAL STYLE ANALYSIS and VISUAL FORMAT REFERENCE sections literally (composition, color, lighting, on-screen text if any).
6. Do not paste metadata, URLs, or hashtags into outputs — translate brief insights into production-ready prompts only.
""" + _NARRATION_LOCALIZATION_RULES


_STORYBOARD_SYSTEM_RULES = """You are a storyboard prompt engineer for AI image generation and video production.

When a RESEARCH BRIEF is provided, your job is to FAITHFULLY REPLICATE that reference video's format — not invent a generic video about the same topic keywords.

""" + _BRIEF_FIDELITY_RULES + """
STRICT OUTPUT RULES:
1. "storyboard[].visualPrompt" = standalone image-generation/stock-footage prompt (max ~200 chars). Include: subject, action, environment, lighting, camera/framing. NEVER include metadata, URLs, hashtags, or stats.
2. "storyboard[].narrationText" = spoken lines ONLY when the brief calls for voiceover. Natural rhythm for TTS. Use "" when the brief is silent/ambient-only.
3. "script" = all narration lines joined, or "" if no voiceover. Spoken words only — no metadata.
4. Scene count: as many scenes as the brief requires (1–5). Default to 3–5 only when the brief does not specify structure.
5. If VISUAL REFERENCE LOCK is provided, set storyboard[].environment, storyboard[].character, and storyboard[].gadgets to the EXACT anchor strings on every scene (use "" for gadgets when N/A). visualPrompt must merge scene-specific action with those anchors without contradicting them.

Return JSON with keys: script (string), outline (array of {sectionTitle, durationSeconds, talkingPoints}), storyboard (array of {sceneNumber, visualPrompt, narrationText, environment, character, gadgets})."""


CREATIVE_STORYBOARD_RULES = """You are a Creative Director and Storyboard Artist.
Your job is NOT to copy the provided research. Your job is to REINTERPRET it to maximize audience value.

---

**FOUNDATIONAL TECHNIQUES (The "6 Oral Techniques")**
You MUST apply these to every `narrationText` field:
1. **Theatrical Pacing & False Start**: Use breathy openings (ellipses...), gradual speed/intensity build, and sudden full stops (periods) at peak peril.
2. **Vocal Volume Whiplash**: Use ALL CAPS for sudden roars/jump-scares; use soft, fragmented sentences for intimacy; return to a steady rhythm for resolution.
3. **Embodied & Interactive Delivery**: Treat the audience as participants—ask rhetorical questions or use "you" to make them lean in.
4. **Tangible Metaphor for the Abstract**: Translate the threat/theme into a physical, visible transformation (e.g., "cracked earth spreading", "light dimming") and put this into the `visualPrompt`.
5. **Environmental Grounding**: Include a brief auditory or sensory anchor in the narration (e.g., "Feel the damp sand beneath your feet...").
6. **Temporal Manipulation & Direct Address**: Jump between ancient past and present, and directly tell one listener that they might be the chosen one ("...and that one might just be you.").

---

**PHASE 1: CORE EXTRACTION (Internal)**
Extract the following from the Fact Finder / Research Brief:
- The Emotional Core (e.g., grief, joy, nostalgia, discovery).
- The Primary Archetypes (Hero, Shadow, Heart, Trickster, Elder).
- The Visual Vocabulary (colors, setting, key objects).
- The Audience Language (whether English-speaking or another language — infer from brief, title, and locale signals before writing any narration).

---

**PHASE 2: CREATIVE REINTERPRETATION (Internal)**
Unless VALUE LENS (USER-SELECTED) appears in Context, generate 3 distinct "Value Lenses":
- **Lens A — Emotional Connection**: raw vulnerability, silence, tears, sensory intimacy.
- **Lens B — Educational / Practical Utility**: how-to, step-by-step, history, culture, teach something concrete.
- **Lens C — Interactive / Audience Participation**: rhetorical questions, direct address, invitations to choose or comment.
Each Lens must serve a fundamentally different audience need — not just different visual adjectives.

---

**PHASE 3: SELECTION & EXECUTION**
- If VALUE LENS (USER-SELECTED) appears in Context: skip lens generation and auto-selection; execute EXCLUSIVELY through that lens.
- Otherwise choose the 1 Value Lens that best fits the `content_format` (Short/Long) and the user's `creative_angle` (if provided).
- Generate the storyboard EXCLUSIVELY through the chosen Lens.
- The `visualPrompt` must reflect the Lens (e.g., if "Educational", show close-ups of historical artifacts; if "Aesthetic", show luxurious lighting and interior design).
- The `narrationText` must drive the Lens (e.g., if "Choice", directly ask the audience which style they prefer; if "Cultural", tell the ancient history).

When RESEARCH BRIEF specifies no voiceover / ambient-only / silent format: apply Value Lens to visualPrompt only; leave narrationText and script empty unless the brief allows minimal speech.

---

**JSON OUTPUT SPECIFICATION (Strict)**
Return a JSON object with these exact keys and structures. Do not add extra keys.

{
  "creativeDirective": "string (explain which Lens you chose and why, 1-2 sentences)",

  "script": "string (the full spoken script with inline [performance notes] for pacing, but keep the main narration text cleanly punctuated for TTS).",

  "outline": [
    {
      "sectionTitle": "string",
      "durationSeconds": integer,
      "talkingPoints": ["string", "string"]
    }
  ],

  "storyboard": [
    {
      "sceneNumber": integer,
      "environment": "string (setting/location/lighting — IDENTICAL on every scene unless brief changes location; \"\" if N/A)",
      "character": "string (subject appearance/wardrobe — IDENTICAL on every scene; \"\" if N/A)",
      "gadgets": "string (props/devices — IDENTICAL on every scene; \"\" if N/A)",
      "visualPrompt": "string (scene-specific action/framing merged with environment/character/gadgets, max 200 chars)",
      "narrationText": "string (the spoken words for this scene, must inherently use the 6 Oral Techniques)"
    }
  ]
}

---

**OUTPUT RULES**
- Do NOT mention the rejected Lenses in the final output.
- The storyboard MUST apply the 6 Oral Techniques to the `narrationText`.
- Write narrationText and script entirely in the Audience Language from Phase 1 — consistent language throughout, not one language with foreign proper nouns only.
- Absolutely NO copyrighted characters (Mama Coco, Disney, etc.)—replace with archetypal equivalents ("The Ancestor", "The Grandmother's Memory", "The Festival of Souls").
- `visualPrompt` must be a standalone image-generation query (scene action + framing + lighting, merged with environment/character/gadgets fields).
- If VISUAL REFERENCE LOCK is provided, copy environment/character/gadgets fields identically across all scenes and merge into each visualPrompt.

""" + _NARRATION_LOCALIZATION_RULES + """
Now, execute your process using the provided Context and Format.
"""

# Back-compat alias
STORYTELLING_SYSTEM_RULES = CREATIVE_STORYBOARD_RULES


def generate_storyboard(
    prompt: str = "",
    content_format: str = "long",
    topic: str = "",
    creative_angle: str = "",
    visual_style_notes: str = "",
    visual_references: list | None = None,
    storytelling_enabled: bool = False,
    research_brief: str = "",
    value_lens: str = "auto",
) -> dict:
    effective_topic = strip_hashtags(topic) if topic else extract_topic(prompt)
    has_brief = bool((research_brief or "").strip())
    reference_anchors = analyze_visual_references(visual_references)
    user_task = (prompt or "").strip() or (
        "Replicate the reference video shot-for-shot from the RESEARCH BRIEF. "
        "Match scene count, framing, pacing, emotional arc, and audio format exactly."
        if has_brief
        else "Plan scene image prompts for the topic. Each visualPrompt must work as a standalone image search query."
    )
    context = build_storyboard_context(
        effective_topic,
        creative_angle,
        visual_style_notes,
        user_task,
        visual_references=visual_references,
        research_brief=research_brief,
        value_lens=value_lens if storytelling_enabled else "auto",
        reference_anchors=reference_anchors,
    )

    if not is_configured():
        mock = _mock_storyboard(
            effective_topic, content_format, visual_references, reference_anchors
        )
        return normalize_storyboard_output(
            mock,
            context,
            content_format,
            topic=effective_topic,
            visual_style=visual_style_notes,
            visual_references=visual_references,
            storytelling_enabled=storytelling_enabled,
            reference_anchors=reference_anchors,
        )

    try:
        format_instruction = (
            "YouTube Short (under 60s, vertical 9:16)"
            if content_format == "short"
            else "standard long-form YouTube video (16:9)"
        )
        system_rules = CREATIVE_STORYBOARD_RULES if storytelling_enabled else _STORYBOARD_SYSTEM_RULES
        result = chat_json(
            f"{system_rules}\n\nFormat: {format_instruction}\n\nContext:\n{context}",
            system_prompt="You output structured storyboard JSON for video production.",
            temperature=0.55 if storytelling_enabled else 0.5,
        )
        return normalize_storyboard_output(
            result,
            context,
            content_format,
            topic=effective_topic,
            visual_style=visual_style_notes,
            visual_references=visual_references,
            storytelling_enabled=storytelling_enabled,
            reference_anchors=reference_anchors,
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
