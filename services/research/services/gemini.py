import re
import httpx
import google.generativeai as genai
from research.config import GEMINI_API_KEY

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def get_model(name="gemini-2.5-flash", use_search=False):
    if not GEMINI_API_KEY:
        return None
    # Enable Google Search grounding if requested
    tools = [{"google_search_retrieval": {}}] if use_search else None
    return genai.GenerativeModel(name, tools=tools)

def perform_web_search(prompt: str) -> dict:
    if not GEMINI_API_KEY:
        return {
            "sources": [
                {
                    "title": f"Introductory Guide to {prompt}",
                    "url": "https://wikipedia.org/wiki/Special:Search?search=" + prompt.replace(" ", "+"),
                    "snippet": f"A comprehensive baseline article discussing key concepts of {prompt}."
                },
                {
                    "title": f"Recent trends in {prompt} (Medium)",
                    "url": "https://medium.com/search?q=" + prompt.replace(" ", "+"),
                    "snippet": f"Industry analysis and creator blogs focusing on {prompt} workflows."
                }
            ]
        }
        
    try:
        model = get_model(use_search=True)
        response = model.generate_content(
            f"Search the web and find the most relevant sources and facts for: {prompt}. Return a concise summary of the facts."
        )
        
        sources = []
        try:
            candidate = response.candidates[0]
            if hasattr(candidate, "grounding_metadata") and candidate.grounding_metadata:
                metadata = candidate.grounding_metadata
                if hasattr(metadata, "grounding_chunks") and metadata.grounding_chunks:
                    for chunk in metadata.grounding_chunks:
                        if hasattr(chunk, "web") and chunk.web:
                            sources.append({
                                "title": chunk.web.title or "Web Source",
                                "url": chunk.web.uri,
                                "snippet": chunk.web.title
                            })
        except Exception as e:
            print(f"Error parsing grounding metadata: {e}")
            
        if not sources:
            sources = [
                {
                    "title": f"Google Search results for {prompt}",
                    "url": "https://www.google.com/search?q=" + prompt.replace(" ", "+"),
                    "snippet": "Search results for: " + prompt
                }
            ]
            
        return {"sources": sources}
    except Exception as e:
        print(f"Gemini search failed: {e}")
        return {
            "sources": [
                {
                    "title": "Google Search Fallback",
                    "url": "https://google.com/search?q=" + prompt.replace(" ", "+"),
                    "snippet": f"Failed to retrieve live Gemini grounding sources. Error: {str(e)}"
                }
            ]
        }

def strip_markdown(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*\*(.+?)\*\*\*", r"\1", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
    text = re.sub(r"^[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _load_image_data(image_url: str) -> dict:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    }
    if "tiktok" in image_url:
        headers["Referer"] = "https://www.tiktok.com/"
    elif "ytimg.com" in image_url or "youtube" in image_url:
        headers["Referer"] = "https://www.youtube.com/"

    with httpx.Client(timeout=20.0, follow_redirects=True) as client:
        res = client.get(image_url, headers=headers)
        res.raise_for_status()
        content_type = res.headers.get("content-type", "image/jpeg")
        mime_type = content_type.split(";")[0]
        if not mime_type.startswith("image/"):
            raise ValueError(f"Unexpected content type: {mime_type}")
        return {"mime_type": mime_type, "data": res.content}


def analyze_trend_thumbnail(thumbnail_url: str, title: str = "", description: str = "") -> str:
    if not thumbnail_url:
        return ""
    if not GEMINI_API_KEY:
        return (
            f"Visual reference: thumbnail for '{title or 'trending video'}'. "
            "Enable GEMINI_API_KEY for AI vision analysis of format, on-screen text, and aesthetic."
        )

    try:
        image_part = _load_image_data(thumbnail_url)
        model = get_model()
        context_lines = []
        if title:
            context_lines.append(f"Video title: {title}")
        if description:
            context_lines.append(f"Description: {description}")
        context = "\n".join(context_lines)

        response = model.generate_content(
            [
                "Analyze this trending short-form video thumbnail or cover frame. Describe:\n"
                "1. Visual format (e.g. iMessage/text chat UI, POV, talking head, lyric card, split screen)\n"
                "2. Any on-screen text you can read verbatim\n"
                "3. Color palette and aesthetic mood\n"
                "4. Composition, UI elements, and layout\n"
                "5. Why this visual style hooks viewers\n"
                "6. Concrete steps to replicate this format for a similar music promo video\n\n"
                "Be specific and actionable. Plain text only, no markdown."
                + (f"\n\n{context}" if context else ""),
                image_part,
            ]
        )
        return response.text.strip()
    except Exception as e:
        print(f"Trend thumbnail analysis failed: {e}")
        return ""


def perform_summarization(prompt: str, visual_analysis: str = "") -> dict:
    visual_section = ""
    if visual_analysis:
        visual_section = (
            "\n\nVisual Format Reference (from thumbnail analysis)\n\n"
            + strip_markdown(visual_analysis)
        )

    if not GEMINI_API_KEY:
        base = strip_markdown(
            f"Creator Brief: {prompt}\n\n"
            f"This brief summarizes the key findings for '{prompt}'. It highlights target audience interest, "
            f"potential storyboard narrative hooks, and audio rhythm directions based on current trends.\n\n"
            f"Hook Focus: Deep atmospheric setup followed by energetic tutorials.\n"
            f"Pacing: 85Bpm lofi or 110Bpm retro synthwaves."
        )
        return {
            "summaryText": base + visual_section,
            "sources": [{"title": "Default Creator Template", "url": "https://youtube.com"}],
        }
        
    try:
        model = get_model()
        system_instructions = (
            "You are a helpful assistant. Synthesize the provided query, transcripts, or research notes into a detailed, "
            "professional Creator Brief in plain text only. Do not use Markdown or any formatting characters "
            "(no #, **, *, ---, bullets with dashes, etc.). Use clear section titles on their own lines, "
            "blank lines between sections, and simple numbered or lettered lists when needed. "
            "When a trending video is provided, center the brief on that video's topic, facts, and why it resonates. "
            "If a VISUAL STYLE ANALYSIS section is included, you MUST add a dedicated section titled "
            "'Visual Format Reference' that explains the thumbnail format (UI layout, on-screen text, colors) "
            "and how to replicate it shot-by-shot. Do not replace it with generic golden-hour aesthetic advice. "
            "The brief should outline the core hook, structure, and key narrative insights."
        )
        response = model.generate_content(
            f"{system_instructions}\n\nInput Content:\n{prompt}"
        )
        
        urls = re.findall(r'(https?://[^\s)]+)', prompt)
        sources = [{"title": f"Source {i+1}", "url": url} for i, url in enumerate(list(set(urls))[:3])]
        if not sources:
            sources = [{"title": "Gemini Synthesis Engine", "url": "https://ai.google.dev"}]

        summary_text = strip_markdown(response.text)
        if visual_analysis and "Visual Format Reference" not in summary_text:
            summary_text = summary_text.rstrip() + visual_section
            
        return {
            "summaryText": summary_text,
            "sources": sources
        }
    except Exception as e:
        print(f"Gemini summarization failed: {e}")
        return {
            "summaryText": f"Error synthesizing brief: {str(e)}",
            "sources": []
        }
