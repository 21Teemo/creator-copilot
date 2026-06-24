import re
import time
import yt_dlp
from datetime import datetime
from youtube_transcript_api import YouTubeTranscriptApi
from research.services.gemini import get_model

# In-memory cache for trends search
_trends_cache = {}
CACHE_EXPIRATION_SECONDS = 600  # 10 minutes


def get_cached_trends(cache_key: str):
    if cache_key in _trends_cache:
        cached_time, data = _trends_cache[cache_key]
        if time.time() - cached_time < CACHE_EXPIRATION_SECONDS:
            return data
    return None


def set_cached_trends(cache_key: str, data: list):
    _trends_cache[cache_key] = (time.time(), data)


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


def generate_trend_explanation(title: str, description: str, channel: str, transcript: str) -> str:
    try:
        model = get_model()
        if not model:
            return "No explanation available. (Gemini API Key not configured)"

        prompt = f"""
Analyze this trending YouTube video's details and explain in exactly 2-3 short bullet points WHY it is trending or what creators can learn from it:
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
