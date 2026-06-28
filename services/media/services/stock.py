import httpx
from urllib.parse import quote

from media.config import PEXELS_API_KEY


def enrich_stock_query(prompt: str, visual_references: list | None = None) -> str:
    if not visual_references:
        return prompt
    labels = []
    for ref in visual_references:
        label = (ref.get("label") or "").strip()
        if label:
            labels.append(label)
    if not labels:
        return prompt
    return f"{prompt}, {', '.join(labels)}"[:200]


def search_pexels_photos(
    query: str,
    visual_references: list | None = None,
    *,
    pick_index: int | None = None,
    per_page: int = 8,
) -> list:
    query = enrich_stock_query(query, visual_references)
    if not PEXELS_API_KEY:
        return []

    headers = {"Authorization": PEXELS_API_KEY}
    url = (
        "https://api.pexels.com/v1/search?"
        f"query={quote(query)}&per_page={max(per_page, 1)}"
    )
    try:
        with httpx.Client(timeout=30.0) as client:
            res = client.get(url, headers=headers)
            res.raise_for_status()
            data = res.json()

            photos = data.get("photos", [])
            if not photos:
                return []

            if pick_index is not None:
                photo = photos[pick_index % len(photos)]
                return [
                    {
                        "sceneNumber": pick_index + 1,
                        "imageUrl": photo["src"]["large"],
                        "visualPrompt": photo.get("alt") or f"Stock photo matching {query}",
                    }
                ]

            results = []
            for i, photo in enumerate(photos):
                results.append(
                    {
                        "sceneNumber": i + 1,
                        "imageUrl": photo["src"]["large"],
                        "visualPrompt": photo.get("alt") or f"Stock photo matching {query}",
                    }
                )
            return results
    except Exception as e:
        print(f"Pexels photo search failed: {e}")
        return []


def search_pexels_videos(query: str, visual_references: list | None = None) -> list:
    query = enrich_stock_query(query, visual_references)
    if not PEXELS_API_KEY:
        return []

    headers = {"Authorization": PEXELS_API_KEY}
    url = f"https://api.pexels.com/v1/videos/search?query={quote(query)}&per_page=8"
    try:
        with httpx.Client(timeout=30.0) as client:
            res = client.get(url, headers=headers)
            res.raise_for_status()
            data = res.json()

            results = []
            for i, video in enumerate(data.get("videos", [])):
                video_files = video.get("video_files", [])
                video_url = None
                for f in video_files:
                    if f.get("file_type") == "video/mp4" or f.get("link", "").split("?")[0].endswith(".mp4"):
                        video_url = f.get("link")
                        break
                if not video_url and video_files:
                    video_url = video_files[0].get("link")

                if video_url:
                    results.append(
                        {
                            "sceneNumber": i + 1,
                            "videoUrl": video_url,
                            "visualPrompt": f"Stock video of {query} by {video.get('user', {}).get('name', 'Pexels')}",
                        }
                    )
            return results
    except Exception as e:
        print(f"Pexels video search failed: {e}")
        return []
