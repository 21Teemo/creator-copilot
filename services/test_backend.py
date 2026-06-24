import time
import httpx

BASE_URL_RESEARCH = "http://127.0.0.1:8001/api/v1/projects/test-project"
BASE_URL_SCRIPTING = "http://127.0.0.1:8002/api/v1/projects/test-project"
BASE_URL_MEDIA = "http://127.0.0.1:8003/api/v1/projects/test-project"
BASE_URL_SEO = "http://127.0.0.1:8004/api/v1/projects/test-project"

def test_research_service():
    print("Testing Research Service (Port 8001)...")
    with httpx.Client(timeout=60.0) as client:
        # Test Trends
        res = client.post(f"{BASE_URL_RESEARCH}/research/trends/long", json={"prompt": "AI coding", "contentFormat": "long"})
        print(f"  Trends code: {res.status_code}")
        assert res.status_code == 200, res.text
        trends = res.json()
        assert len(trends) > 0
        print(f"  Trends fetched successfully. Sample: {trends[0]['title']}")
        
        # Test Web Search
        res = client.post(f"{BASE_URL_RESEARCH}/research/web-search", json={"prompt": "Gemini 2.5 Flash details", "contentFormat": "long"})
        print(f"  Web Search code: {res.status_code}")
        assert res.status_code == 200, res.text
        search_res = res.json()
        assert "sources" in search_res
        print("  Web Search succeeded.")

        # Test Summarize
        res = client.post(f"{BASE_URL_RESEARCH}/research/summarize", json={"prompt": "Explain reactive agents.", "contentFormat": "long"})
        print(f"  Summarize code: {res.status_code}")
        assert res.status_code == 200, res.text
        summary = res.json()
        assert "summaryText" in summary
        print("  Summarize succeeded.")

def test_scripting_service():
    print("\nTesting Scripting Service (Port 8002)...")
    with httpx.Client(timeout=60.0) as client:
        # Test Storyboard
        payload = {"prompt": "Create a story about black holes", "contentFormat": "short", "includeAudio": True}
        res = client.post(f"{BASE_URL_SCRIPTING}/scripting/storyboard", json=payload)
        print(f"  Storyboard code: {res.status_code}")
        assert res.status_code == 200, res.text
        sb = res.json()
        assert "storyboard" in sb
        assert len(sb["storyboard"]) > 0
        print(f"  Storyboard generated. Narration sample: {sb['storyboard'][0]['narrationText']}")
        
        # Test Thumbnail grading
        grade_payload = {"prompt": "Space black hole neon theme", "imageUrl": "https://images.unsplash.com/photo-1542831371-29b0f74f9713", "contentFormat": "short"}
        res = client.post(f"{BASE_URL_SCRIPTING}/thumbnails/thumb-1/grade", json=grade_payload)
        print(f"  Grading code: {res.status_code}")
        assert res.status_code == 200, res.text
        grade = res.json()
        assert "ctrScore" in grade
        print(f"  Grading completed. Score: {grade['ctrScore']}, Feedback: {grade['feedback']}")

def test_media_service():
    print("\nTesting Media Service (Port 8003)...")
    with httpx.Client(timeout=60.0) as client:
        # Test Stock Photo search
        res = client.post(f"{BASE_URL_MEDIA}/stock/search", json={"prompt": "cyberpunk city"})
        print(f"  Stock search code: {res.status_code}")
        assert res.status_code == 200, res.text
        photos = res.json()
        assert len(photos) > 0
        print(f"  Stock photos search succeeded. Sample: {photos[0]['imageUrl']}")
        
        # Test Stock Video search
        res = client.post(f"{BASE_URL_MEDIA}/stock/videos", json={"prompt": "neon transit"})
        print(f"  Stock videos code: {res.status_code}")
        assert res.status_code == 200, res.text
        videos = res.json()
        assert len(videos) > 0
        print(f"  Stock videos search succeeded. Sample: {videos[0]['videoUrl']}")

        # Test video rendering end-to-end
        render_payload = {
            "contentFormat": "short",
            "includeAudio": True,
            "storyboard": [
                {
                    "sceneNumber": 1,
                    "visualPrompt": "deep space cosmic nebula",
                    "narrationText": "In the depths of space, a cosmic anomaly exists."
                },
                {
                    "sceneNumber": 2,
                    "visualPrompt": "cyberpunk city street",
                    "narrationText": "A cyberpunk metropolis glowing with neon signs."
                }
            ],
            "sceneImages": [],
            "sceneVideos": []
        }
        print("  Triggering video rendering...")
        res = client.post(f"{BASE_URL_MEDIA}/video/render", json=render_payload)
        print(f"  Render trigger code: {res.status_code}")
        assert res.status_code == 200, res.text
        task_id = res.json()["taskId"]
        print(f"  Enqueued task ID: {task_id}")
        
        # Poll for status
        max_attempts = 30
        for attempt in range(max_attempts):
            res = client.get(f"{BASE_URL_MEDIA}/video/render/{task_id}/status")
            assert res.status_code == 200, res.text
            status_data = res.json()
            status = status_data["status"]
            progress = status_data["progress"]
            print(f"    Attempt {attempt + 1}: Status={status}, Progress={progress}%")
            if status == "complete":
                print(f"  Video compilation SUCCESS! URL: {status_data['videoUrl']}")
                break
            elif status == "failed":
                print(f"  Video compilation FAILED: {status_data.get('error')}")
                assert False, "Video rendering task failed."
            time.sleep(3)
        else:
            assert False, "Video rendering timed out."

def test_seo_service():
    print("\nTesting SEO Service (Port 8004)...")
    with httpx.Client(timeout=60.0) as client:
        # Test Titles
        res = client.post(f"{BASE_URL_SEO}/seo/titles", json={"script": "Video about mastering Python and fastapi."})
        print(f"  Titles code: {res.status_code}")
        assert res.status_code == 200, res.text
        titles_res = res.json()
        assert "titles" in titles_res
        print(f"  Titles: {titles_res['titles']}")

        # Test Metadata
        res = client.post(f"{BASE_URL_SEO}/seo/metadata", json={"script": "Video about mastering Python and fastapi."})
        print(f"  Metadata code: {res.status_code}")
        assert res.status_code == 200, res.text
        meta = res.json()
        assert "description" in meta
        assert "tags" in meta
        assert "chapters" in meta
        print("  Metadata generation succeeded.")

        # Test Publish draft
        res = client.post(f"{BASE_URL_SEO}/publish", json={"contentFormat": "long"})
        print(f"  Publish code: {res.status_code}")
        assert res.status_code == 200, res.text
        pub = res.json()
        assert pub["status"] == "success"
        assert "publishedUrl" in pub
        print(f"  Draft publication simulated. URL: {pub['publishedUrl']}")

if __name__ == "__main__":
    print("=== STARTING END-TO-END BACKEND VERIFICATION ===")
    test_research_service()
    test_scripting_service()
    test_media_service()
    test_seo_service()
    print("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")
