import re
import time
import yt_dlp
from datetime import datetime
from youtube_transcript_api import YouTubeTranscriptApi
from research.services.gemini import get_model

# In-memory cache for trends search
_trends_cache = {}
CACHE_EXPIRATION_SECONDS = 600  # 10 minutes — YouTube long-form default

# TikTok passive mode: cache hits long while yt-dlp extractor is broken; retry failures hourly
TIKTOK_TRENDS_CACHE_SUCCESS_SECONDS = 7 * 24 * 3600  # 7 days
TIKTOK_TRENDS_CACHE_FAILURE_SECONDS = 3600  # 1 hour — retry after yt-dlp hotfixes

# Hard freshness guardrail — discard content older than 30 days post-fetch
FRESHNESS_MAX_HOURS = 720

_rewrite_cache = {}
REWRITE_CACHE_EXPIRATION_SECONDS = 3600  # 1 hour

_explanation_cache = {}
EXPLANATION_CACHE_EXPIRATION_SECONDS = 3600  # 1 hour

_FILLER_PREFIXES = (
    "filter trends:",
    "explore trends:",
    "find trends:",
    "search trends:",
)


def get_cached_trends(cache_key: str, ttl_seconds: int | None = None) -> list | None:
    if cache_key not in _trends_cache:
        return None
    entry = _trends_cache[cache_key]
    cached_time, data = entry[0], entry[1]
    ttl = entry[2] if len(entry) > 2 else (ttl_seconds or CACHE_EXPIRATION_SECONDS)
    if time.time() - cached_time < ttl:
        return data
    return None


def set_cached_trends(cache_key: str, data: list, ttl_seconds: int | None = None) -> None:
    ttl = ttl_seconds or CACHE_EXPIRATION_SECONDS
    _trends_cache[cache_key] = (time.time(), data, ttl)


def _strip_search_filler(user_prompt: str) -> str:
    cleaned = user_prompt.strip()
    lower = cleaned.lower()
    for prefix in _FILLER_PREFIXES:
        if lower.startswith(prefix):
            return cleaned[len(prefix):].strip()
    return cleaned


def rewrite_to_tiktok_search(user_prompt: str) -> str:
    """
    Convert vague user requests into concise TikTok search keywords.
    Results are memoized to avoid repeat Gemini calls.
    """
    normalized = _strip_search_filler(user_prompt)
    if not normalized:
        return user_prompt.strip()

    cache_key = f"tiktok_{normalized.lower()}"
    if cache_key in _rewrite_cache:
        cached_time, rewritten = _rewrite_cache[cache_key]
        if time.time() - cached_time < REWRITE_CACHE_EXPIRATION_SECONDS:
            return rewritten

    current_year = datetime.now().year
    model = get_model()
    if not model:
        rewritten = normalized
    else:
        system_prompt = f"""
You are a TikTok trend analyst.
Convert the user's vague request into a highly effective, keyword-dense search query for TikTok short-form videos.

Rules:
1. Strip all filler words (e.g., "I want", "find me", "videos about", "looking for").
2. Focus on the core subject + action + mood/vibe (what performs on TikTok FYP).
3. Keep it under 6 words (TikTok search favors punchy niche keywords).
4. Do NOT append years or dates — TikTok hashtags are timeless (e.g. "funnycats" not "funnycats 2026").
5. Output ONLY the pure search string. No explanations, quotes, hashtags, or formatting.
6. Do not append country names or region tags unless the user explicitly mentions a location.

Example 1: User: "Funny moments with dogs and cats" -> Output: funny cats fails
Example 2: User: "POV storytime drama" -> Output: POV storytime drama
Example 3: User: "Satisfying cooking clips" -> Output: satisfying cooking ASMR
"""
        try:
            response = model.generate_content(f"{system_prompt}\n\nUser request: {normalized}")
            rewritten = response.text.strip().strip('"').strip("'").lstrip("#")
            if not rewritten or len(rewritten) < 2:
                rewritten = normalized
            else:
                rewritten = re.sub(r"\s+USA\b", "", rewritten, flags=re.IGNORECASE).strip()
        except Exception as e:
            print(f"AI rewrite failed: {e}. Using raw query.")
            rewritten = normalized

    _rewrite_cache[cache_key] = (time.time(), rewritten)
    if rewritten != normalized:
        print(f"AI rewrote TikTok search: '{normalized}' -> '{rewritten}'")
    return rewritten


def rewrite_to_youtube_search(user_prompt: str, is_short: bool) -> str:
    """
    Convert vague user requests into concise YouTube search keywords.
    Results are memoized to avoid repeat Gemini calls.
    """
    normalized = _strip_search_filler(user_prompt)
    if not normalized:
        return user_prompt.strip()

    cache_key = f"{normalized.lower()}_{is_short}"
    if cache_key in _rewrite_cache:
        cached_time, rewritten = _rewrite_cache[cache_key]
        if time.time() - cached_time < REWRITE_CACHE_EXPIRATION_SECONDS:
            return rewritten

    current_year = datetime.now().year
    content_type = "YouTube Shorts" if is_short else "long-form YouTube videos"

    model = get_model()
    if not model:
        rewritten = normalized
    else:
        system_prompt = f"""
You are a YouTube SEO and trend analyst.
Convert the user's vague request into a highly effective, keyword-dense search query for {content_type}.

Rules:
1. Strip all filler words (e.g., "I want", "find me", "videos about", "looking for").
2. Focus on the core subject + action + mood/vibe.
3. Keep it under 7 words (YouTube prioritizes short, sharp keywords).
4. If a specific year is not mentioned, naturally append "{current_year}" for recency.
5. Output ONLY the pure search string. No explanations, quotes, or formatting.
6. Do not append country names or region tags unless the user explicitly mentions a location.

Example 1: User: "I need cool background music for my travel vlog" -> Output: travel vlog background music {current_year}
Example 2: User: "Funny moments with dogs and cats" -> Output: funny dogs cats compilation
Example 3: User: "How to make money online as a student" -> Output: make money online student {current_year}
"""
        try:
            response = model.generate_content(f"{system_prompt}\n\nUser request: {normalized}")
            rewritten = response.text.strip().strip('"').strip("'")
            if not rewritten or len(rewritten) < 2:
                rewritten = normalized
            else:
                rewritten = re.sub(r"\s+USA\b", "", rewritten, flags=re.IGNORECASE).strip()
        except Exception as e:
            print(f"AI rewrite failed: {e}. Using raw query.")
            rewritten = normalized

    _rewrite_cache[cache_key] = (time.time(), rewritten)
    if rewritten != normalized:
        print(f"AI rewrote search: '{normalized}' -> '{rewritten}'")
    return rewritten


def format_views(view_count):
    if not view_count:
        return "N/A"
    try:
        views = int(view_count)
        if views >= 1_000_000:
            return f"{views / 1_000_000:.1f}M".replace(".0M", "M")
        elif views >= 1_000:
            return f"{views / 1_000:.0f}K"
        return str(views)
    except Exception:
        return "N/A"


def format_duration(duration_seconds):
    if not duration_seconds:
        return "0:00"
    try:
        seconds = int(duration_seconds)
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"
    except Exception:
        return "0:00"


def format_published_at(upload_date):
    if not upload_date or len(upload_date) != 8:
        return "N/A"
    return f"{upload_date[0:4]}-{upload_date[4:6]}-{upload_date[6:8]}"


def calculate_hours_since_upload(upload_date: str) -> float:
    if not upload_date or len(upload_date) != 8:
        return 1.0
    try:
        dt = datetime.strptime(upload_date, "%Y%m%d")
        delta = datetime.now() - dt
        return max(1.0, delta.total_seconds() / 3600.0)
    except Exception:
        return 1.0


def calculate_virality_score(views: int, likes: int, comments: int, followers: int, hours: float) -> float:
    # 1. Comment velocity: comments per hour, cap at 50 comments/hr. Map 0-50 to 0-100.
    comment_velocity = (min(50.0, comments / hours) / 50.0) * 100.0

    # 2. Like ratio: likes per view, scaled to 0-100
    like_ratio = min(1.0, likes / max(1, views)) * 100.0

    # 3. Subscriber gap: views per follower, cap at 50x follower count. Map 0-50 to 0-100.
    sub_gap = (min(50.0, views / max(1, followers)) / 50.0) * 100.0

    # Composite score calculation (normalized ranges)
    score = (comment_velocity * 0.4) + (like_ratio * 0.2) + (sub_gap * 0.4)
    return min(100.0, max(0.0, score))


def _is_tiktok_url(video_url: str) -> bool:
    return "tiktok.com" in (video_url or "").lower()


def generate_trend_explanation(
    title: str, description: str, channel: str, transcript: str, video_url: str = ""
) -> str:
    try:
        model = get_model()
        if not model:
            return "No explanation available. (Gemini API Key not configured)"

        platform = "TikTok" if _is_tiktok_url(video_url) else "YouTube"
        prompt = f"""
Analyze this trending {platform} video's details and explain in exactly 2-3 short bullet points WHY it is trending or what creators can learn from it:
Channel: {channel}
Title: {title}
Description: {description}
Transcript Snippet: {transcript[:2000] if transcript else "No transcript available"}

Rules:
1. Provide exactly 2-3 short bullet points.
2. Focus on why it went viral (hook, content structure, editing style).
3. Do not mention any other intro or outro.
4. Keep it brief (under 50 words per bullet).
"""
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Error generating AI trend explanation: {e}")
        return "Could not generate AI analysis for this trend."


def fetch_trend_explanation_lazy(
    title: str,
    description: str,
    channel: str,
    video_url: str,
) -> str:
    """Fetch transcript + Gemini explanation on demand; results are cached by video URL."""
    if not video_url:
        return "No video URL available for analysis."

    if video_url in _explanation_cache:
        cached_time, explanation = _explanation_cache[video_url]
        if time.time() - cached_time < EXPLANATION_CACHE_EXPIRATION_SECONDS:
            return explanation

    transcript = ""
    if not _is_tiktok_url(video_url):
        try:
            transcript = fetch_youtube_transcript(video_url)
            if "Could not retrieve transcript" in transcript:
                transcript = ""
        except Exception as e:
            print(f"Transcript fetch for lazy explanation failed: {e}")

    explanation = generate_trend_explanation(title, description, channel, transcript, video_url)
    _explanation_cache[video_url] = (time.time(), explanation)
    return explanation


def extract_video_id(url: str) -> str:
    match = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11}).*', url)
    return match.group(1) if match else url


def fetch_youtube_transcript(video_url: str) -> str:
    try:
        video_id = extract_video_id(video_url)
        # Handle both standard PyPI version (static get_transcript) and library version 1.2.4 (fetch)
        if hasattr(YouTubeTranscriptApi, 'get_transcript'):
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        else:
            transcript_list = YouTubeTranscriptApi().fetch(video_id)

        segments = []
        for segment in transcript_list:
            if isinstance(segment, dict):
                text = segment.get('text', '')
            else:
                text = getattr(segment, 'text', '')
            segments.append(text)

        full_text = " ".join(segments)
        return full_text
    except Exception as e:
        print(f"Error fetching transcript: {e}")
        return f"Could not retrieve transcript for {video_url}. (Error: {str(e)})"
