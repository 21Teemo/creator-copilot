import os
import re
import asyncio
import concurrent.futures
from datetime import datetime
from typing import Optional, List

from TikTokApi import TikTokApi

from research.services.common import (
    get_cached_trends,
    set_cached_trends,
    calculate_hours_since_upload,
    calculate_virality_score,
    rewrite_to_tiktok_search,
    FRESHNESS_MAX_HOURS,
    TIKTOK_TRENDS_CACHE_SUCCESS_SECONDS,
    TIKTOK_TRENDS_CACHE_FAILURE_SECONDS,
    format_views,
    format_duration,
    format_published_at,
)

TIKTOK_MAX_DURATION_SECONDS = 180
# TikTok hashtag feed: 0 = top/viral (default), 1 = newest first
TIKTOK_HASHTAG_SORT_NEWEST = 1


def _is_tiktok_scrape_failure(trends: List[dict]) -> bool:
    return (
        len(trends) == 1
        and trends[0].get("channelName") == "System Alert"
        and not trends[0].get("videoUrl")
    )


def _tiktok_cache_ttl(trends: List[dict]) -> int:
    if _is_tiktok_scrape_failure(trends):
        return TIKTOK_TRENDS_CACHE_FAILURE_SECONDS
    return TIKTOK_TRENDS_CACHE_SUCCESS_SECONDS


def _int_stat(value) -> int:
    if value is None:
        return 0
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def _tiktokapi_session_kwargs() -> dict:
    ms_token = os.environ.get("MS_TOKEN") or os.environ.get("ms_token")
    headless = os.environ.get("TIKTOK_HEADLESS", "false").lower() in ("1", "true", "yes")
    kwargs = {
        "num_sessions": 1,
        "sleep_after": 3,
        "browser": os.environ.get("TIKTOK_BROWSER", "chromium"),
        "headless": headless,
    }
    if ms_token:
        kwargs["ms_tokens"] = [ms_token]
    return kwargs


def _is_tiktok_video_id(video_id: Optional[str]) -> bool:
    return bool(video_id and str(video_id).isdigit() and len(str(video_id)) >= 15)


def _slugify_tiktok_tag(query: str) -> str:
    cleaned = re.sub(r"\b20\d{2}\b", "", query.lower())
    return re.sub(r"[^a-z0-9]", "", cleaned)


def _tiktok_tag_candidates(query: str) -> List[str]:
    cleaned = re.sub(r"\b20\d{2}\b", "", query.lower())
    words = re.findall(r"[a-z0-9]+", cleaned)

    candidates: List[str] = []
    full_slug = _slugify_tiktok_tag(query)
    if full_slug:
        candidates.append(full_slug)
    if len(words) >= 2:
        two_word = "".join(words[:2])
        if two_word not in candidates:
            candidates.append(two_word)
    if words and words[0] not in candidates:
        candidates.append(words[0])

    return candidates or ["fyp"]


def _flat_reject_reason(entry: dict, min_views: int) -> Optional[str]:
    video_id = entry.get("id")
    if not _is_tiktok_video_id(video_id):
        return "invalid_id"

    flat_views = _int_stat(entry.get("view_count"))
    if flat_views < min_views:
        return f"low_views({flat_views}<{min_views})"

    flat_duration = entry.get("duration")
    if flat_duration is not None and flat_duration > TIKTOK_MAX_DURATION_SECONDS:
        return f"reject_long_duration({flat_duration}s)"

    return None


def _resolve_tiktok_video_url(entry: dict) -> str:
    webpage_url = entry.get("webpage_url") or entry.get("url")
    if webpage_url and "tiktok.com" in webpage_url and "/video/" in webpage_url:
        return webpage_url.split("?")[0]

    video_id = entry.get("id")
    uploader = entry.get("uploader") or ""
    uploader = str(uploader).lstrip("@")
    if uploader and video_id:
        return f"https://www.tiktok.com/@{uploader}/video/{video_id}"
    if video_id:
        return f"https://www.tiktok.com/video/{video_id}"
    return ""


def _video_to_flat_entry(video) -> dict:
    data = video.as_dict or {}
    stats = video.stats or data.get("statsV2") or data.get("stats") or {}
    author_data = data.get("author") or {}
    username = ""
    if video.author and getattr(video.author, "username", None):
        username = video.author.username
    else:
        username = author_data.get("uniqueId") or author_data.get("nickname") or ""

    create_time = data.get("createTime")
    upload_date = ""
    if create_time is not None:
        upload_date = datetime.fromtimestamp(int(create_time)).strftime("%Y%m%d")
    elif video.create_time:
        upload_date = video.create_time.strftime("%Y%m%d")

    video_meta = data.get("video") or {}
    duration_raw = video_meta.get("duration")
    duration = int(duration_raw) if duration_raw is not None else None
    if duration is not None and duration > 1000:
        duration = int(duration / 1000)

    cover = (
        video_meta.get("cover")
        or video_meta.get("originCover")
        or video_meta.get("dynamicCover")
        or ""
    )
    if isinstance(cover, list) and cover:
        cover = cover[0]

    title = data.get("desc") or "TikTok Video"
    vid_id = str(video.id or data.get("id") or "")
    username = str(username).lstrip("@")

    return {
        "id": vid_id,
        "title": title,
        "description": title,
        "view_count": _int_stat(stats.get("playCount")),
        "like_count": _int_stat(stats.get("diggCount") or stats.get("likeCount")),
        "comment_count": _int_stat(stats.get("commentCount")),
        "follower_count": _int_stat((author_data.get("stats") or {}).get("followerCount")),
        "duration": duration,
        "upload_date": upload_date,
        "uploader": username,
        "thumbnail": cover if isinstance(cover, str) else "",
        "webpage_url": (
            f"https://www.tiktok.com/@{username}/video/{vid_id}"
            if username
            else f"https://www.tiktok.com/video/{vid_id}"
        ),
        "source": "tiktokapi",
    }


def _log_flat_search_audit(entries: list, min_views: int) -> None:
    summary = {
        "total": 0,
        "invalid_id": 0,
        "low_views": 0,
        "long_duration": 0,
        "unknown_duration": 0,
        "passed_flat": 0,
    }

    print(f"[TIKTOK FLAT AUDIT] Logging {len(entries)} TikTokApi results")

    for index, entry in enumerate(entries, start=1):
        summary["total"] += 1
        video_id = entry.get("id")
        title = (entry.get("title") or "Untitled").replace("\n", " ")[:80]
        video_url = _resolve_tiktok_video_url(entry) or "N/A"
        duration = entry.get("duration")
        flat_views = _int_stat(entry.get("view_count"))
        duration_label = f"{duration}s" if duration is not None else "unknown"

        if not _is_tiktok_video_id(video_id):
            summary["invalid_id"] += 1
            reason = "invalid_id"
        else:
            reject = _flat_reject_reason(entry, min_views)
            if reject:
                if reject.startswith("low_views"):
                    summary["low_views"] += 1
                elif reject.startswith("reject_long_duration"):
                    summary["long_duration"] += 1
                reason = reject
            elif duration is None:
                summary["unknown_duration"] += 1
                summary["passed_flat"] += 1
                reason = "queued_for_deep_unknown_duration"
            else:
                summary["passed_flat"] += 1
                reason = f"queued_for_deep({duration}s)"

        print(
            f"[TIKTOK FLAT #{index:03d}] {reason} | duration={duration_label} | "
            f"views={flat_views} | {video_url} | {title}"
        )

    print(
        "[TIKTOK FLAT AUDIT SUMMARY] "
        f"total={summary['total']} "
        f"long_duration={summary['long_duration']} "
        f"unknown_duration={summary['unknown_duration']} "
        f"low_views={summary['low_views']} "
        f"invalid_id={summary['invalid_id']} "
        f"passed_flat={summary['passed_flat']}"
    )


def _process_tiktokapi_entry(entry: dict, min_views: int) -> Optional[dict]:
    video_id = entry.get("id")
    if not _is_tiktok_video_id(video_id):
        return None

    output_url = _resolve_tiktok_video_url(entry)
    if not output_url:
        return None

    title = (entry.get("title") or "Unknown Video").replace("\n", " ")[:80]
    views = _int_stat(entry.get("view_count"))
    likes = _int_stat(entry.get("like_count"))
    comments = _int_stat(entry.get("comment_count"))
    followers = _int_stat(entry.get("follower_count"))
    upload_date = entry.get("upload_date") or ""
    full_duration = entry.get("duration")

    if views < min_views:
        print(f"[TIKTOK DEEP REJECT] low_views({views}<{min_views}) | {output_url} | {title}")
        return None

    hours = calculate_hours_since_upload(upload_date)
    if hours > FRESHNESS_MAX_HOURS:
        print(
            f"[TIKTOK DEEP REJECT] too_old({hours:.0f}h>{FRESHNESS_MAX_HOURS}h) | "
            f"{output_url} | {title}"
        )
        return None

    if full_duration and full_duration > TIKTOK_MAX_DURATION_SECONDS:
        print(
            f"[TIKTOK DEEP REJECT] long_duration({full_duration}s>{TIKTOK_MAX_DURATION_SECONDS}s) | "
            f"{output_url} | {title}"
        )
        return None

    print(
        f"[TIKTOK DEEP OK] duration={full_duration}s views={views} followers={followers} | "
        f"{output_url} | {title}"
    )

    comment_velocity = comments / hours
    subscriber_gap = min(50.0, views / max(1, followers))
    virality_score = calculate_virality_score(views, likes, comments, followers, hours)

    channel_name = str(entry.get("uploader") or "Unknown Creator").lstrip("@")

    return {
        "title": entry.get("title") or "Unknown Video",
        "views": format_views(views),
        "rawViews": views,
        "duration": format_duration(full_duration),
        "durationSeconds": int(full_duration or 0),
        "description": entry.get("description") or "No description available.",
        "channelName": channel_name,
        "publishedAt": format_published_at(upload_date),
        "videoUrl": output_url,
        "thumbnailUrl": entry.get("thumbnail") or "",
        "likes": likes,
        "comments": comments,
        "subscriberCount": followers,
        "commentVelocity": round(comment_velocity, 1),
        "subscriberGap": round(subscriber_gap, 2),
        "viralityScore": round(virality_score, 1),
    }


def _process_single_tiktok_candidate(entry: dict, min_views: int) -> Optional[dict]:
    return _process_tiktokapi_entry(entry, min_views)


async def _iter_hashtag_videos(
    tag,
    api: TikTokApi,
    *,
    count: int,
    sort_type: int = TIKTOK_HASHTAG_SORT_NEWEST,
    **kwargs,
):
    """Paginate challenge/item_list with explicit sort (TikTokApi.videos ignores sort_type)."""
    if getattr(tag, "id", None) is None:
        await tag.info(**kwargs)

    found = 0
    cursor = 0
    while found < count:
        params = {
            "challengeID": tag.id,
            "count": min(30, count - found),
            "cursor": cursor,
            "sortType": sort_type,
        }
        resp = await api.make_request(
            url="https://www.tiktok.com/api/challenge/item_list/",
            params=params,
            headers=kwargs.get("headers"),
            session_index=kwargs.get("session_index"),
        )
        if resp is None:
            raise RuntimeError("TikTok returned an invalid response.")

        for video_data in resp.get("itemList", []):
            yield api.video(data=video_data)
            found += 1
            if found >= count:
                return

        if not resp.get("hasMore", False):
            return
        cursor = resp.get("cursor")


async def _fetch_hashtag_videos_async(hashtag_names: List[str], limit: int) -> list:
    entries: list = []
    session_kwargs = _tiktokapi_session_kwargs()
    async with TikTokApi() as api:
        await api.create_sessions(**session_kwargs)
        for name in hashtag_names:
            if len(entries) >= limit:
                break
            try:
                tag = api.hashtag(name=name)
                remaining = limit - len(entries)
                async for video in _iter_hashtag_videos(
                    tag,
                    api,
                    count=remaining,
                    sort_type=TIKTOK_HASHTAG_SORT_NEWEST,
                ):
                    entries.append(_video_to_flat_entry(video))
                    if len(entries) >= limit:
                        break
                if entries:
                    print(
                        f"[TIKTOKAPI] Resolved {len(entries)} newest videos for hashtag #{name}"
                    )
                    return entries
            except Exception as e:
                print(f"[TIKTOKAPI] Hashtag #{name} failed: {e}")

    return entries


def _run_async(coro):
    """Run async TikTokApi code from sync FastAPI handlers (nested event loop safe)."""
    def _runner():
        return asyncio.run(coro)

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(_runner).result()


def _run_tiktok_tag_search(hashtag_names: List[str], limit: int) -> list:
    try:
        return _run_async(_fetch_hashtag_videos_async(hashtag_names, limit))
    except Exception as e:
        print(f"[TIKTOKAPI] Search failed: {e}")
        return []


def fetch_short_trends(
    query: str,
    min_views: int = 1000,
    sort_by: str = "breakout",
) -> List[dict]:
    now = datetime.now()
    current_year = now.year
    current_month = now.strftime("%B")

    cache_key = f"tiktok_{query}_{min_views}_{sort_by}_{current_year}_{current_month}"
    cached = get_cached_trends(cache_key)
    if cached:
        ttl_label = "failure" if _is_tiktok_scrape_failure(cached) else "success"
        print(f"Returning cached TikTok trends ({ttl_label} TTL) for key: {cache_key}")
        return cached

    actual_query = query
    if "tiktok.com/" in query:
        tag_match = re.search(r"/tag/([^/?#]+)", query)
        if tag_match:
            actual_query = tag_match.group(1)
            print(f"Resolved TikTok tag URL '{query}' to #{actual_query}.")

    if actual_query and actual_query.strip():
        actual_query = rewrite_to_tiktok_search(actual_query)

    search_limit = 100
    if not actual_query or actual_query.strip() == "":
        actual_query = f"viral fyp {current_year}"
        search_query_label = actual_query
    else:
        search_query_label = actual_query

    hashtag_names = _tiktok_tag_candidates(actual_query)
    print(f"Executing TikTokApi hashtag search for: '{search_query_label}' -> {hashtag_names}")

    candidate_entries = _run_tiktok_tag_search(hashtag_names, search_limit)
    _log_flat_search_audit(candidate_entries, min_views)

    valid_candidates = []
    for entry in candidate_entries:
        if _flat_reject_reason(entry, min_views) is None:
            valid_candidates.append(entry)

    valid_candidates.sort(
        key=lambda x: x.get("upload_date") or "00000000",
        reverse=True,
    )

    candidates = valid_candidates

    trends = []
    if candidates:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(candidates), 8)) as executor:
            futures = [
                executor.submit(_process_single_tiktok_candidate, entry, min_views)
                for entry in candidates
            ]
            for future in concurrent.futures.as_completed(futures):
                try:
                    res = future.result()
                    if res:
                        trends.append(res)
                except Exception as fut_err:
                    print(f"Error processing TikTok candidate in thread: {fut_err}")

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

    if not trends:
        print("No TikTok trends resolved. Returning fallback placeholder alert card.")
        ms_hint = (
            " Set MS_TOKEN from your TikTok browser cookies if bot detection persists."
            if not (os.environ.get("MS_TOKEN") or os.environ.get("ms_token"))
            else ""
        )
        trends = [
            {
                "title": f"No active TikTok trends resolved for '{actual_query}'",
                "views": "N/A",
                "rawViews": 0,
                "duration": "0:00",
                "description": (
                    "TikTokApi could not fetch hashtag videos. Try TIKTOK_HEADLESS=false, "
                    "set MS_TOKEN from tiktok.com cookies, and ensure Playwright is installed."
                    + ms_hint
                ),
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
                "trendExplanation": (
                    "• TikTokApi uses Playwright — run `python -m playwright install chromium`.\n"
                    "• Set TIKTOK_HEADLESS=false for best results; MS_TOKEN reduces bot blocks.\n"
                    "• Failures retry hourly; successful results cache 7 days."
                ),
            }
        ]

    cache_ttl = _tiktok_cache_ttl(trends)
    set_cached_trends(cache_key, trends, cache_ttl)
    print(f"Cached TikTok trends for {cache_ttl // 3600}h (key: {cache_key})")
    return trends
