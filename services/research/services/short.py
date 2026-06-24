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


def _format_label(duration: Optional[int]) -> str:
    if duration is None:
        return "unknown_duration"
    if duration <= 61:
        return "likely_short_9x16"
    return "likely_long_16x9"


def _log_flat_search_audit(entries: list, min_views: int) -> None:
    """Log every ytsearch hit with URL, duration, and flat-filter rejection reason."""
    summary = {
        "total": 0,
        "invalid_id": 0,
        "low_views": 0,
        "long_duration": 0,
        "unknown_duration": 0,
        "likely_short": 0,
        "passed_flat": 0,
    }

    print(f"[SHORTS FLAT AUDIT] Logging {len(entries)} ytsearch results (check watch links below)")

    for index, entry in enumerate(entries, start=1):
        summary["total"] += 1
        video_id = entry.get("id")
        title = (entry.get("title") or "Untitled").replace("\n", " ")[:80]
        watch_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else "N/A"
        duration = entry.get("duration")
        flat_views = int(entry.get("view_count") or 0)
        format_label = _format_label(duration)
        duration_label = f"{duration}s" if duration is not None else "unknown"

        if not video_id or len(video_id) != 11:
            summary["invalid_id"] += 1
            reason = "invalid_id"
        elif flat_views < min_views:
            summary["low_views"] += 1
            reason = f"low_views({flat_views}<{min_views})"
        elif duration is None:
            summary["unknown_duration"] += 1
            summary["passed_flat"] += 1
            reason = "passed_flat_unknown_duration"
        elif duration > 61:
            summary["long_duration"] += 1
            reason = f"long_duration({duration}s>61s)"
        else:
            summary["likely_short"] += 1
            summary["passed_flat"] += 1
            reason = f"passed_flat_short({duration}s)"

        print(
            f"[SHORTS FLAT #{index:03d}] {reason} | format={format_label} | "
            f"duration={duration_label} | views={flat_views} | {watch_url} | {title}"
        )

    print(
        "[SHORTS FLAT AUDIT SUMMARY] "
        f"total={summary['total']} "
        f"likely_long_16x9={summary['long_duration']} "
        f"likely_short_9x16={summary['likely_short']} "
        f"unknown_duration={summary['unknown_duration']} "
        f"low_views={summary['low_views']} "
        f"invalid_id={summary['invalid_id']} "
        f"passed_flat={summary['passed_flat']}"
    )


def _process_single_short_candidate(entry: dict, min_views: int) -> Optional[dict]:
    video_id = entry.get("id")
    if not video_id:
        return None

    extract_url = f"https://www.youtube.com/watch?v={video_id}"
    output_url = f"https://www.youtube.com/shorts/{video_id}"

    try:
        ydl_opts_full = {
            'quiet': True,
            'skip_download': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts_full) as ydl:
            full_info = ydl.extract_info(extract_url, download=False)

            title = (full_info.get("title") or "Unknown Video").replace("\n", " ")[:80]
            views = int(full_info.get("view_count") or 0)
            likes = int(full_info.get("like_count") or 0)
            comments = int(full_info.get("comment_count") or 0)
            followers = int(full_info.get("channel_follower_count") or 0)
            upload_date = full_info.get("upload_date") or ""
            full_duration = full_info.get("duration")
            width = full_info.get("width")
            height = full_info.get("height")

            if views < min_views:
                print(
                    f"[SHORTS DEEP REJECT] low_views({views}<{min_views}) | {extract_url} | {title}"
                )
                return None

            hours = calculate_hours_since_upload(upload_date)
            if hours > FRESHNESS_MAX_HOURS:
                print(
                    f"[SHORTS DEEP REJECT] too_old({hours:.0f}h>{FRESHNESS_MAX_HOURS}h) | "
                    f"{extract_url} | {title}"
                )
                return None

            if full_duration and full_duration > 61:
                print(
                    f"[SHORTS DEEP REJECT] long_duration({full_duration}s>61s) | {extract_url} | {title}"
                )
                return None

            if width and height and width >= height:
                print(
                    f"[SHORTS DEEP REJECT] horizontal_aspect({width}x{height}) | {extract_url} | {title}"
                )
                return None

            aspect_label = f"{width}x{height}" if width and height else "unknown"
            print(
                f"[SHORTS DEEP OK] duration={full_duration}s aspect={aspect_label} views={views} | "
                f"{output_url} | {title}"
            )

            comment_velocity = comments / hours
            subscriber_gap = views / max(1, followers)
            virality_score = calculate_virality_score(views, likes, comments, followers, hours)

            # Fetch transcript and generate Gemini AI trend explanation for all candidates
            transcript_text = ""
            ai_explanation = ""
            try:
                transcript_text = fetch_youtube_transcript(extract_url)
                if "Could not retrieve transcript" in transcript_text:
                    transcript_text = ""
                ai_explanation = generate_trend_explanation(
                    full_info.get("title") or "Unknown Video",
                    full_info.get("description") or "",
                    full_info.get("uploader") or "Unknown Channel",
                    transcript_text
                )
            except Exception as ex:
                print(f"[SHORTS DEEP] AI/transcript step failed for {video_id}: {ex}")

            thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

            return {
                "title": full_info.get("title") or "Unknown Video",
                "views": format_views(views),
                "rawViews": views,
                "duration": format_duration(full_info.get("duration")),
                "description": full_info.get("description") or "No description available.",
                "channelName": full_info.get("uploader") or full_info.get("channel") or "Unknown Channel",
                "publishedAt": format_published_at(upload_date),
                "videoUrl": output_url,
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
        print(f"[SHORTS DEEP ERROR] {extract_url}: {e}")
        return None


def fetch_short_trends(
        query: str,
        min_views: int = 1000,
        sort_by: str = "breakout"
) -> List[dict]:
    now = datetime.now()
    current_year = now.year
    current_month = now.strftime("%B")

    # Cache key specific to shorts
    cache_key = f"shorts_{query}_{min_views}_{sort_by}_{current_year}_{current_month}"
    cached = get_cached_trends(cache_key)
    if cached:
        print(f"Returning cached shorts trends for key: {cache_key}")
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
        actual_query = rewrite_to_youtube_search(actual_query, is_short=True)

    # Build search query for shorts (vertical format filtered downstream by duration/aspect ratio)
    search_limit = 100
    if not actual_query or actual_query.strip() == "":
        search_query = f"trending shorts {current_year}"
    else:
        search_query = f"ytsearch{search_limit}:{actual_query}"

    print(f"Executing Shorts YouTube search query: '{search_query}'")

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
        print(f"Error running flat search for shorts: {e}")

    _log_flat_search_audit(candidate_entries, min_views)

    # Pre-filter at flat level
    valid_candidates = []
    for entry in candidate_entries:
        video_id = entry.get("id")
        if not video_id or len(video_id) != 11:
            continue

        flat_views = int(entry.get("view_count") or 0)
        if flat_views < min_views:
            continue

        # Duration filter: strictly vertical/Shorts format (<= 61 seconds)
        duration = entry.get("duration")
        if duration and duration > 61:
            continue

        valid_candidates.append(entry)

    # Preserve YouTube search relevance order; process a wider pool for SubGap ranking
    candidates = valid_candidates[:25]

    trends = []
    if candidates:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(candidates), 8)) as executor:
            futures = [
                executor.submit(_process_single_short_candidate, entry, min_views)
                for entry in candidates
            ]
            for future in concurrent.futures.as_completed(futures):
                try:
                    res = future.result()
                    if res:
                        trends.append(res)
                except Exception as fut_err:
                    print(f"Error processing short candidate in thread: {fut_err}")

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

    trends = trends[:5]

    # Fallback alert item if empty
    if not trends:
        print("No short trends resolved. Returning fallback placeholder alert card.")
        trends = [
            {
                "title": f"No active YouTube trends resolved for '{actual_query}'",
                "views": "N/A",
                "rawViews": 0,
                "duration": "0:00",
                "description": "We couldn't retrieve matching Shorts. This usually happens when YouTube rate-limits anonymous scraping traffic, under high network latency, or if there are no short videos matching the keyword.",
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
