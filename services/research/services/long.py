import yt_dlp
import concurrent.futures
from datetime import datetime
from typing import Optional, List

from research.services.common import (
    get_cached_trends,
    set_cached_trends,
    calculate_hours_since_upload,
    calculate_virality_score,
    rewrite_to_youtube_search,
    FRESHNESS_MAX_HOURS,
    fetch_youtube_transcript,
    generate_trend_explanation,
    format_views,
    format_duration,
    format_published_at
)

def _process_single_long_candidate(entry: dict, min_views: int) -> Optional[dict]:
    video_id = entry.get("id")
    if not video_id:
        return None

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

            # Check view filter
            if views < min_views:
                return None

            # Hard cutoff: ignore videos older than 30 days to keep the feed fresh.
            hours = calculate_hours_since_upload(upload_date)
            if hours > FRESHNESS_MAX_HOURS:
                return None

            # Calculate scores
            comment_velocity = comments / hours
            subscriber_gap = views / max(1, followers)
            virality_score = calculate_virality_score(views, likes, comments, followers, hours)

            # Fetch transcript and generate Gemini AI trend explanation for all candidates
            transcript_text = ""
            ai_explanation = ""
            try:
                transcript_text = fetch_youtube_transcript(video_url)
                if "Could not retrieve transcript" in transcript_text:
                    transcript_text = ""
                ai_explanation = generate_trend_explanation(
                    full_info.get("title") or "Unknown Video",
                    full_info.get("description") or "",
                    full_info.get("uploader") or "Unknown Channel",
                    transcript_text
                )
            except Exception as ex:
                print(f"[LONG DEEP] AI/transcript step failed for {video_id}: {ex}")

            thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

            return {
                "title": full_info.get("title") or "Unknown Video",
                "views": format_views(views),
                "rawViews": views,
                "duration": format_duration(full_info.get("duration")),
                "durationSeconds": int(full_info.get("duration") or 0),
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
                "trendExplanation": ai_explanation,
            }
    except Exception as e:
        print(f"Error fetching full details for long video {video_id}: {e}")
        return None


def fetch_long_trends(
        query: str,
        min_views: int = 5000,
        sort_by: str = "breakout"
) -> List[dict]:
    now = datetime.now()
    current_year = now.year
    current_month = now.strftime("%B")

    # Cache key specific to long-form
    cache_key = f"long_{query}_{min_views}_{sort_by}_{current_year}_{current_month}"
    cached = get_cached_trends(cache_key)
    if cached:
        print(f"Returning cached long trends for key: {cache_key}")
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

    if actual_query and actual_query.strip():
        actual_query = rewrite_to_youtube_search(actual_query, is_short=False)

    # Build search query for long-form
    search_limit = 50
    if not actual_query or actual_query.strip() == "":
        search_query = f"trending {current_year}"
    else:
        year_suffix = f" {current_year}" if str(current_year) not in actual_query else ""
        search_query = f"ytsearch{search_limit}:{actual_query}{year_suffix}"

    print(f"Executing Long-form YouTube search query: '{search_query}'")

    # Flat extraction
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
        print(f"Error running flat search for long videos: {e}")

    # Pre-filter at flat level
    valid_candidates = []
    for entry in candidate_entries:
        video_id = entry.get("id")
        if not video_id or len(video_id) != 11:
            continue

        flat_views = int(entry.get("view_count") or 0)
        if flat_views < min_views:
            continue

        valid_candidates.append(entry)

    candidates = valid_candidates

    trends = []
    if candidates:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(candidates), 8)) as executor:
            futures = [
                executor.submit(_process_single_long_candidate, entry, min_views)
                for entry in candidates
            ]
            for future in concurrent.futures.as_completed(futures):
                try:
                    res = future.result()
                    if res:
                        trends.append(res)
                except Exception as fut_err:
                    print(f"Error processing long candidate in thread: {fut_err}")

    # Sort results — prioritize breakout potential (SubGap)
    if sort_by in ("breakout", "subgap"):
        trends.sort(key=lambda x: x.get("subscriberGap", 0.0), reverse=True)
    elif sort_by == "virality":
        trends.sort(key=lambda x: x.get("viralityScore", 0.0), reverse=True)
    elif sort_by == "newest":
        trends.sort(key=lambda x: x.get("publishedAt", ""), reverse=True)
    elif sort_by == "views":
        trends.sort(key=lambda x: x.get("rawViews", 0), reverse=True)
    else:
        trends.sort(key=lambda x: x.get("subscriberGap", 0.0), reverse=True)

    # Fallback alert item if empty
    if not trends:
        print("No long trends resolved. Returning fallback placeholder alert card.")
        trends = [
            {
                "title": f"No active YouTube trends resolved for '{actual_query}'",
                "views": "N/A",
                "rawViews": 0,
                "duration": "0:00",
                "description": "We couldn't retrieve matching videos. This usually happens when YouTube rate-limits anonymous scraping traffic, under high network latency, or if there are no matching videos for the keyword.",
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

    set_cached_trends(cache_key, trends)
    return trends
