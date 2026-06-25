"""
YouTube heatmap-based engagement segment detection.

Adapted from TomazAlexandre/shortsyoutube (analyzer.py) — uses yt-dlp heatmap metadata
to find the most re-watched moments inside a video.
"""

import time
import random
import yt_dlp
from typing import Optional, List

_engagement_cache = {}
ENGAGEMENT_CACHE_EXPIRATION_SECONDS = 3600


def _seconds_to_str(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def _normalize_video_url(video_url: str) -> str:
    """Prefer watch URLs for yt-dlp metadata extraction."""
    if "/shorts/" in video_url:
        video_id = video_url.rstrip("/").split("/")[-1].split("?")[0]
        if len(video_id) == 11:
            return f"https://www.youtube.com/watch?v={video_id}"
    return video_url


def fetch_youtube_heatmap(video_url: str) -> Optional[list]:
    extract_url = _normalize_video_url(video_url)
    try:
        with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
            info = ydl.extract_info(extract_url, download=False)
            heatmap = info.get("heatmap")
            if heatmap and len(heatmap) > 0:
                return heatmap
    except Exception as e:
        print(f"[heatmap] fetch failed for {extract_url}: {e}")
    return None


def _get_duration(video_url: str) -> int:
    extract_url = _normalize_video_url(video_url)
    try:
        with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
            return int(ydl.extract_info(extract_url, download=False).get("duration") or 300)
    except Exception:
        return 300


def _segments_from_heatmap(
    heatmap: list,
    num_segments: int,
    clip_duration: int,
    skip_intro_seconds: int,
) -> List[dict]:
    total_duration = int(heatmap[-1]["end_time"])
    timeline = [0.0] * (total_duration + 1)

    for entry in heatmap:
        start = int(entry.get("start_time", 0))
        end = int(entry.get("end_time", start + 1))
        value = float(entry.get("value", 0))
        for t in range(start, min(end + 1, len(timeline))):
            timeline[t] = value

    window_scores = []
    search_start = min(skip_intro_seconds, max(0, total_duration // 4))
    for i in range(search_start, max(search_start, len(timeline) - clip_duration)):
        score = sum(timeline[i : i + clip_duration])
        window_scores.append((i, score))

    window_scores.sort(key=lambda x: x[1], reverse=True)
    min_gap = max(clip_duration * 2, 30 if clip_duration <= 15 else 120)

    selected = []
    for start, score in window_scores:
        too_close = any(abs(start - segment["start"]) < min_gap for segment in selected)
        if too_close:
            continue
        end = min(start + clip_duration, total_duration)
        norm_score = min(100.0, (score / max(clip_duration, 1)) * 100)
        selected.append(
            {
                "start": start,
                "end": end,
                "startLabel": _seconds_to_str(start),
                "endLabel": _seconds_to_str(end),
                "score": round(norm_score, 1),
            }
        )
        if len(selected) >= num_segments:
            break

    selected.sort(key=lambda x: x["start"])
    return selected


def _tiktok_segments_from_metrics(
    duration: int,
    num_segments: int,
    clip_duration: int,
    skip_intro_seconds: int,
    view_count: int = 0,
    like_count: int = 0,
    comment_count: int = 0,
) -> List[dict]:
    if duration <= clip_duration:
        engagement = min(100.0, 50.0 + (like_count / max(1, view_count)) * 500)
        return [
            {
                "start": 0,
                "end": duration,
                "startLabel": _seconds_to_str(0),
                "endLabel": _seconds_to_str(duration),
                "score": round(engagement, 1),
            }
        ]

    like_rate = like_count / max(1, view_count)
    comment_rate = comment_count / max(1, view_count)

    # High comment rate → payoff mid/late; high like rate → strong hook + mid beat
    if comment_rate > 0.01:
        positions_pct = [0.05, 0.42, 0.68]
    elif like_rate > 0.08:
        positions_pct = [0.03, 0.28, 0.52]
    else:
        positions_pct = [0.12, 0.38, 0.62]

    usable_start = min(skip_intro_seconds, duration // 4)
    base_score = min(95.0, 55.0 + like_rate * 400 + comment_rate * 200)

    segments = []
    for i, pct in enumerate(positions_pct[:num_segments]):
        start = max(usable_start, int(duration * pct))
        end = min(start + clip_duration, duration)
        score = max(40.0, base_score - i * 6)
        segments.append(
            {
                "start": start,
                "end": end,
                "startLabel": _seconds_to_str(start),
                "endLabel": _seconds_to_str(end),
                "score": round(score, 1),
            }
        )
    return segments


def _heuristic_segments(
    duration: int,
    num_segments: int,
    clip_duration: int,
    skip_intro_seconds: int,
) -> List[dict]:
    if duration <= clip_duration:
        return [
            {
                "start": 0,
                "end": duration,
                "startLabel": _seconds_to_str(0),
                "endLabel": _seconds_to_str(duration),
                "score": 80.0,
            }
        ]

    usable_start = min(skip_intro_seconds, duration // 4)
    positions_pct = [0.25, 0.40, 0.55, 0.70, 0.82]
    random.shuffle(positions_pct)
    positions_pct = sorted(positions_pct[:num_segments])

    segments = []
    for i, pct in enumerate(positions_pct):
        start = max(usable_start, int(duration * pct))
        end = min(start + clip_duration, duration)
        score = max(40.0, 80.0 - i * 8 + random.uniform(-5, 5))
        segments.append(
            {
                "start": start,
                "end": end,
                "startLabel": _seconds_to_str(start),
                "endLabel": _seconds_to_str(end),
                "score": round(score, 1),
            }
        )
    return segments


def analyze_engagement_segments(
    video_url: str,
    duration_seconds: Optional[int] = None,
    is_short: bool = False,
    num_segments: int = 3,
    view_count: Optional[int] = None,
    like_count: Optional[int] = None,
    comment_count: Optional[int] = None,
) -> dict:
    clip_duration = min(12, duration_seconds or 60) if is_short else 45
    if is_short and duration_seconds and duration_seconds <= clip_duration:
        clip_duration = max(3, duration_seconds // 2 or 3)
    skip_intro = 2 if is_short else 60

    if "tiktok.com" in (video_url or "").lower():
        duration = duration_seconds or 60
        if view_count:
            segments = _tiktok_segments_from_metrics(
                duration=duration,
                num_segments=num_segments,
                clip_duration=clip_duration,
                skip_intro_seconds=skip_intro,
                view_count=view_count,
                like_count=like_count or 0,
                comment_count=comment_count or 0,
            )
            source = "tiktok_metrics"
        else:
            segments = _heuristic_segments(duration, num_segments, clip_duration, skip_intro)
            source = "tiktok_heuristic"
        print(f"[heatmap] TikTok video — engagement via {source} for {video_url}")
        return {
            "heatmapAvailable": False,
            "source": source,
            "segments": segments,
        }

    heatmap = fetch_youtube_heatmap(video_url)
    if heatmap:
        segments = _segments_from_heatmap(heatmap, num_segments, clip_duration, skip_intro)
        print(f"[heatmap] Found {len(segments)} engagement peaks via YouTube heatmap for {video_url}")
        return {
            "heatmapAvailable": True,
            "source": "youtube_heatmap",
            "segments": segments,
        }

    duration = duration_seconds if duration_seconds is not None else _get_duration(video_url)
    segments = _heuristic_segments(duration, num_segments, clip_duration, skip_intro)
    print(f"[heatmap] Heatmap unavailable; using heuristic peaks for {video_url}")
    return {
        "heatmapAvailable": False,
        "source": "heuristic",
        "segments": segments,
    }


def fetch_engagement_segments_lazy(
    video_url: str,
    duration_seconds: Optional[int] = None,
    is_short: bool = False,
    view_count: Optional[int] = None,
    like_count: Optional[int] = None,
    comment_count: Optional[int] = None,
) -> dict:
    cache_key = f"{video_url}_{duration_seconds}_{is_short}_{view_count}_{like_count}_{comment_count}"
    if cache_key in _engagement_cache:
        cached_time, data = _engagement_cache[cache_key]
        if time.time() - cached_time < ENGAGEMENT_CACHE_EXPIRATION_SECONDS:
            return data

    result = analyze_engagement_segments(
        video_url=video_url,
        duration_seconds=duration_seconds,
        is_short=is_short,
        view_count=view_count,
        like_count=like_count,
        comment_count=comment_count,
    )
    _engagement_cache[cache_key] = (time.time(), result)
    return result
