import httpx
from media.config import PEXELS_API_KEY

def search_pexels_photos(query: str) -> list:
    if not PEXELS_API_KEY:
        # Fallback to static list if API key is not present
        return [
            {
                "sceneNumber": 1,
                "imageUrl": "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=600&auto=format&fit=crop",
                "visualPrompt": f"Coding setup for {query}"
            },
            {
                "sceneNumber": 2,
                "imageUrl": "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600&auto=format&fit=crop",
                "visualPrompt": f"Abstract technology lines for {query}"
            }
        ]
    
    headers = {"Authorization": PEXELS_API_KEY}
    url = f"https://api.pexels.com/v1/search?query={query}&per_page=8"
    try:
        with httpx.Client() as client:
            res = client.get(url, headers=headers)
            res.raise_for_status()
            data = res.json()
            
            results = []
            for i, photo in enumerate(data.get("photos", [])):
                results.append({
                    "sceneNumber": i + 1,
                    "imageUrl": photo["src"]["large"],
                    "visualPrompt": photo.get("alt") or f"Stock photo matching {query}"
                })
            return results
    except Exception as e:
        print(f"Pexels photo search failed: {e}")
        return []

def search_pexels_videos(query: str) -> list:
    if not PEXELS_API_KEY:
        # Fallback to static video list if API key is not present
        return [
            {
                "sceneNumber": 1,
                "videoUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
                "visualPrompt": f"Deep space cosmic nebula for {query}"
            },
            {
                "sceneNumber": 2,
                "videoUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
                "visualPrompt": f"Cyberpunk neon transit for {query}"
            }
        ]
        
    headers = {"Authorization": PEXELS_API_KEY}
    url = f"https://api.pexels.com/videos/search?query={query}&per_page=8"
    try:
        with httpx.Client() as client:
            res = client.get(url, headers=headers)
            res.raise_for_status()
            data = res.json()
            
            results = []
            for i, video in enumerate(data.get("videos", [])):
                video_files = video.get("video_files", [])
                video_url = None
                # Prefer mp4 video links
                for f in video_files:
                    if f.get("file_type") == "video/mp4" or f.get("link", "").split('?')[0].endswith(".mp4"):
                        video_url = f.get("link")
                        break
                if not video_url and video_files:
                    video_url = video_files[0].get("link")
                    
                if video_url:
                    results.append({
                        "sceneNumber": i + 1,
                        "videoUrl": video_url,
                        "visualPrompt": f"Stock video of {query} by {video.get('user', {}).get('name', 'Pexels')}"
                    })
            return results
    except Exception as e:
        print(f"Pexels video search failed: {e}")
        return []
