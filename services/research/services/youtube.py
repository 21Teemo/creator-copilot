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


def _process_single_candidate(entry: dict, min_views: int, upload_within_hours: int, is_short: bool = False) -> dict:
    video_id = entry.get("id")
    if not video_id:
        return None

    if is_short:
        video_url = f"https://www.youtube.com/shorts/{video_id}"
    else:
        video_url = f"https://www.youtube.com/watch?v={video_id}"

    try:
        # Full metadata extraction for this specific video
        ydl_opts_full = {
            'quiet': True,
            'skip_download': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts_full) as ydl:
            full_info = ydl.extract_info(video_url, download=False)

            # Extract metrics
            views = int(full_info.get("view_count") or 0)
            likes = int(full_info.get("like_count") or 0)
            comments = int(full_info.get("comment_count") or 0)
            followers = int(full_info.get("channel_follower_count") or 0)
            upload_date = full_info.get("upload_date") or ""

            # Check filters
            if views < min_views:
                return None

            hours = calculate_hours_since_upload(upload_date)
            if upload_within_hours and hours > upload_within_hours:
                return None

            # Calculate scores
            comment_velocity = comments / hours
            subscriber_gap = views / max(1, followers)
            virality_score = calculate_virality_score(views, likes, comments, followers, hours)

            # Try to get transcript & summary for the top videos
            transcript_text = ""
            ai_explanation = ""
            try:
                try:
                    transcript_text = fetch_youtube_transcript(video_url)
                except Exception as tx_ex:
                    print(f"Failed to fetch transcript for {video_id}: {tx_ex}")

                cleaned_transcript = ""
                if transcript_text and "Could not retrieve transcript" not in transcript_text:
                    cleaned_transcript = transcript_text

                ai_explanation = generate_trend_explanation(
                    full_info.get("title") or "Unknown Video",
                    full_info.get("description") or "",
                    full_info.get("uploader") or "Unknown Channel",
                    cleaned_transcript
                )
            except Exception as ex:
                print(f"Failed to fetch AI explanation for {video_id}: {ex}")

            thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

            return {
                "title": full_info.get("title") or "Unknown Video",
                "views": format_views(views),
                "rawViews": views,
                "duration": format_duration(full_info.get("duration")),
                "description": full_info.get("description") or "No description available.",
                "channelName": full_info.get("uploader") or full_info.get("channel") or "Unknown Channel",
                "publishedAt": format_published_at(upload_date),
                "videoUrl": video_url,
                "thumbnailUrl": thumbnail_url,
                "likes": likes,
                "comments": comments,
                "subscriberCount": followers,
                "commentVelocity": round(comment_velocity, 1),
                "subscriberGap": round(subscriber_gap, 2),
                "viralityScore": round(virality_score, 1),
                "trendExplanation": ai_explanation
            }
    except Exception as e:
        print(f"Error fetching full details for video {video_id}: {e}")
        return None


def fetch_youtube_trends(
        query: str,
        is_short: bool = False,
        min_views: int = 10000,
        upload_within_hours: int = 168,
        sort_by: str = "virality"
) -> list:
    # Get current year & month dynamically
    now = datetime.now()
    current_year = now.year
    current_month = now.strftime("%B")

    # Cache key
    cache_key = f"{query}_{is_short}_{min_views}_{upload_within_hours}_{sort_by}_{current_year}_{current_month}"
    cached = get_cached_trends(cache_key)
    if cached:
        print(f"Returning cached trends for key: {cache_key}")
        return cached

    actual_query = query
    if "youtube.com/" in query or "youtu.be/" in query:
        try:
            ydl_opts_url = {
                'quiet': True,
                'skip_download': True,
                'extract_flat': True,
            }
            with yt_dlp.YoutubeDL(ydl_opts_url) as ydl:
                info = ydl.extract_info(query, download=False)
                title = info.get("title")
                if title:
                    actual_query = title
                    print(f"Resolved YouTube URL '{query}' to title '{actual_query}' for trends search.")
        except Exception as e:
            print(f"Error resolving YouTube URL title: {e}")

    # Build search query dynamically without hardcoded "2026"
    # Fetch a larger pool for shorts to filter out long videos and low-view matches at the flat level
    search_limit = 100 if is_short else 15
    if not actual_query or actual_query.strip() == "":
        search_query = "#shorts" if is_short else f"trending {current_year}"
    else:
        search_query = f"ytsearch{search_limit}:{actual_query} #shorts" if is_short else f"ytsearch{search_limit}:{actual_query} {current_year}"

    print(f"Executing YouTube search query: '{search_query}'")

    # First, run flat extraction to get top candidate metadata
    ydl_opts_flat = {
        'quiet': True,
        'extract_flat': True,
        'skip_download': True,
    }

    candidate_entries = []
    try:
        with yt_dlp.YoutubeDL(ydl_opts_flat) as ydl:
            info = ydl.extract_info(search_query, download=False)
            if 'entries' in info:
                candidate_entries = info['entries']
    except Exception as e:
        print(f"Error running flat search: {e}")

    # Pre-filter candidates at the flat level (saves API requests and speeds up processing)
    valid_candidates = []
    for entry in candidate_entries:
        video_id = entry.get("id")
        if not video_id:
            continue

        # View count filter at the flat level
        flat_views = int(entry.get("view_count") or 0)
        if flat_views < min_views:
            continue

        # Duration filter for Shorts (<= 61 seconds)
        if is_short:
            duration = entry.get("duration")
            if duration and duration > 61:
                continue

        valid_candidates.append(entry)

    trends = []

    # Process top 5 valid candidates concurrently to keep response times bounded and avoid socket/proxy timeouts
    import concurrent.futures
    candidates = valid_candidates[:5]

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(candidates), 5)) as executor:
        futures = [
            executor.submit(_process_single_candidate, entry, min_views, upload_within_hours, is_short)
            for entry in candidates
        ]
        for future in concurrent.futures.as_completed(futures):
            try:
                res = future.result()
                if res:
                    trends.append(res)
            except Exception as fut_err:
                print(f"Error processing candidate in thread: {fut_err}")


    # Sort results
    if sort_by == "virality":
        trends.sort(key=lambda x: x.get("viralityScore", 0.0), reverse=True)
    elif sort_by == "newest":
        trends.sort(key=lambda x: x.get("publishedAt", ""), reverse=True)
    elif sort_by == "views":
        trends.sort(key=lambda x: x.get("rawViews", 0), reverse=True)

    # If no trends could be fetched, provide a friendly error placeholder item
    if not trends:
        print("No trends resolved or YouTube is rate-limiting the requests. Returning fallback placeholder alert card.")
        trends = [
            {
                "title": f"No active YouTube trends resolved for '{actual_query}'",
                "views": "N/A",
                "rawViews": 0,
                "duration": "0:00",
                "description": "We couldn't retrieve matching videos. This usually happens when YouTube rate-limits anonymous scraping traffic or under high network latency.",
                "channelName": "System Alert",
                "publishedAt": "Just now",
                "videoUrl": "",
                "thumbnailUrl": "",
                "likes": 0,
                "comments": 0,
                "subscriberCount": 0,
                "commentVelocity": 0.0,
                "subscriberGap": 0.0,
                "viralityScore": 0.0,
                "trendExplanation": "• YouTube API/scraping traffic is currently rate-limiting this request.\n• Please try again in 5-10 minutes or search for a different topic.\n• Caching is active, so successful queries will load instantly."
            }
        ]

    # Set cache and return
    set_cached_trends(cache_key, trends)
    return trends


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