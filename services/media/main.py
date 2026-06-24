import os
import uvicorn
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from celery.result import AsyncResult

from media.services.stock import search_pexels_photos, search_pexels_videos
from media.futures.render_tasks import celery_app, render_video

app = FastAPI(title="Creator Copilot - Media Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas for Requests/Responses
class SearchPayload(BaseModel):
    prompt: str
    contentFormat: Optional[str] = "long"
    includeAudio: Optional[bool] = True

class StoryboardItem(BaseModel):
    sceneNumber: int
    visualPrompt: str
    narrationText: str

class SceneImageItem(BaseModel):
    sceneNumber: int
    imageUrl: str
    visualPrompt: str

class SceneVideoItem(BaseModel):
    sceneNumber: int
    videoUrl: str
    visualPrompt: str

class RenderPayload(BaseModel):
    contentFormat: Optional[str] = "long"
    includeAudio: Optional[bool] = True
    storyboard: Optional[List[StoryboardItem]] = []
    sceneImages: Optional[List[SceneImageItem]] = []
    sceneVideos: Optional[List[SceneVideoItem]] = []

class RenderTriggerResponse(BaseModel):
    taskId: str

class RenderStatusResponse(BaseModel):
    status: str
    progress: int
    videoUrl: Optional[str] = None
    error: Optional[str] = None

# Routing endpoints
router = APIRouter(prefix="/api/v1/projects/{projectId}")

@router.post("/stock/search")
async def get_stock_photos(projectId: str, payload: SearchPayload):
    photos = search_pexels_photos(payload.prompt)
    return photos

@router.post("/stock/videos")
async def get_stock_videos(projectId: str, payload: SearchPayload):
    videos = search_pexels_videos(payload.prompt)
    return videos

@router.post("/video/render", response_model=RenderTriggerResponse)
async def trigger_render(projectId: str, payload: RenderPayload):
    try:
        # Trigger async rendering in Celery worker
        task = render_video.delay(projectId, payload.model_dump())
        return {"taskId": task.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enqueue render task: {str(e)}")

@router.get("/video/render/{taskId}/status", response_model=RenderStatusResponse)
async def get_render_status(projectId: str, taskId: str):
    res = AsyncResult(taskId, app=celery_app)
    
    status_mapping = {
        "PENDING": "pending",
        "STARTED": "in_progress",
        "PROGRESS": "in_progress",
        "SUCCESS": "complete",
        "FAILURE": "failed",
    }
    
    state = status_mapping.get(res.state, "pending")
    progress = 0
    video_url = None
    error_msg = None
    
    if res.state == "SUCCESS":
        if isinstance(res.result, dict):
            progress = res.result.get("progress", 100)
            video_url = res.result.get("videoUrl")
            state = res.result.get("status", "complete")
            error_msg = res.result.get("error")
        else:
            state = "complete"
            progress = 100
    elif res.state == "PROGRESS" and isinstance(res.info, dict):
        progress = res.info.get("progress", 0)
    elif res.state == "FAILURE":
        state = "failed"
        error_msg = str(res.result)
        
    return {
        "status": state,
        "progress": progress,
        "videoUrl": video_url,
        "error": error_msg
    }

app.include_router(router)

# Mount media static files directory to serve compiled video clips
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8003, reload=True)
