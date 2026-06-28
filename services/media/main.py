import os
import uuid
import uvicorn
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from celery.result import AsyncResult

from media.services.stock import search_pexels_photos, search_pexels_videos
from media.services.image_gen import generate_scene_image
from media.services.video_gen import generate_scene_video
from media.futures.render_tasks import celery_app, render_video
from media.config import (
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_UPLOAD_PRESET,
    AWS_S3_BUCKET,
    AWS_S3_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    PEXELS_API_KEY,
)

app = FastAPI(title="Creator Copilot - Media Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas for Requests/Responses
class VisualReferenceItem(BaseModel):
    category: str
    label: str
    imageUrl: Optional[str] = None

class SearchPayload(BaseModel):
    prompt: str
    visualReferences: Optional[List[VisualReferenceItem]] = None
    contentFormat: Optional[str] = "long"
    includeAudio: Optional[bool] = False

class SceneGeneratePayload(BaseModel):
    prompt: str
    sceneNumber: Optional[int] = None
    visualReferences: Optional[List[VisualReferenceItem]] = None
    contentFormat: Optional[str] = "long"

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
    includeAudio: Optional[bool] = False
    storyboard: Optional[List[StoryboardItem]] = []
    sceneImages: Optional[List[SceneImageItem]] = []
    sceneVideos: Optional[List[SceneVideoItem]] = []

class RenderTriggerResponse(BaseModel):
    taskId: str

class RenderStatusResponse(BaseModel):
    status: str
    progress: int
    step: Optional[str] = None
    elapsedSec: Optional[float] = None
    videoUrl: Optional[str] = None
    error: Optional[str] = None

class UploadResponse(BaseModel):
    url: str
    storage: str

async def _upload_to_cloudinary(content: bytes, filename: str, content_type: str, project_id: str) -> Optional[str]:
    if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET):
        return None

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD_NAME}/auto/upload",
            data={"upload_preset": CLOUDINARY_UPLOAD_PRESET, "folder": f"creator-copilot/{project_id}"},
            files={"file": (filename, content, content_type or "application/octet-stream")},
        )
        response.raise_for_status()
        return response.json().get("secure_url")

def _upload_to_s3(content: bytes, filename: str, content_type: str, project_id: str) -> Optional[str]:
    if not (AWS_S3_BUCKET and AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY):
        return None

    try:
        import boto3
    except ImportError:
        return None

    safe_name = f"{uuid.uuid4().hex}_{filename}"
    key = f"creator-copilot/{project_id}/{safe_name}"
    client = boto3.client(
        "s3",
        region_name=AWS_S3_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )
    client.put_object(
        Bucket=AWS_S3_BUCKET,
        Key=key,
        Body=content,
        ContentType=content_type or "application/octet-stream",
    )
    return f"https://{AWS_S3_BUCKET}.s3.{AWS_S3_REGION}.amazonaws.com/{key}"

def _upload_to_local_static(content: bytes, filename: str, project_id: str, static_dir: str) -> str:
    safe_name = f"{uuid.uuid4().hex}_{filename}"
    rel_path = f"uploads/{project_id}/{safe_name}"
    full_path = os.path.join(static_dir, rel_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(content)
    return f"/api/v1/projects/{project_id}/media/static/{rel_path}"

# Routing endpoints
router = APIRouter(prefix="/api/v1/projects/{projectId}")


def _require_pexels_key() -> None:
    if not PEXELS_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="PEXELS_API_KEY not configured. Add it to services/.env and restart the media service (port 8003).",
        )


@router.post("/stock/search")
async def get_stock_photos(projectId: str, payload: SearchPayload):
    _require_pexels_key()
    refs = [r.model_dump() for r in (payload.visualReferences or [])]
    photos = search_pexels_photos(payload.prompt, visual_references=refs)
    return photos

@router.post("/generate/scene")
async def generate_scene_picture(projectId: str, payload: SceneGeneratePayload):
    refs = [r.model_dump() for r in (payload.visualReferences or [])]
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    try:
        result = generate_scene_image(
            prompt=payload.prompt,
            visual_references=refs,
            content_format=payload.contentFormat or "long",
            project_id=projectId,
            static_dir=static_dir,
            scene_number=payload.sceneNumber,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if payload.sceneNumber is not None:
        result["sceneNumber"] = payload.sceneNumber
    if not result.get("imageUrl"):
        raise HTTPException(status_code=502, detail="Scene image generation returned no image")
    return result


@router.post("/generate/scene/video")
async def generate_scene_video_clip(projectId: str, payload: SceneGeneratePayload):
    refs = [r.model_dump() for r in (payload.visualReferences or [])]
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    try:
        result = generate_scene_video(
            prompt=payload.prompt,
            visual_references=refs,
            content_format=payload.contentFormat or "long",
            project_id=projectId,
            static_dir=static_dir,
            scene_number=payload.sceneNumber,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if payload.sceneNumber is not None:
        result["sceneNumber"] = payload.sceneNumber
    if not result.get("videoUrl"):
        raise HTTPException(status_code=502, detail="Scene video generation returned no video")
    return result

@router.post("/stock/videos")
async def get_stock_videos(projectId: str, payload: SearchPayload):
    _require_pexels_key()
    refs = [r.model_dump() for r in (payload.visualReferences or [])]
    videos = search_pexels_videos(payload.prompt, visual_references=refs)
    return videos

@router.post("/upload", response_model=UploadResponse)
async def upload_asset(projectId: str, file: UploadFile = File(...)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file upload")

    filename = file.filename or "upload"
    content_type = file.content_type or "application/octet-stream"
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

    try:
        cloud_url = await _upload_to_cloudinary(content, filename, content_type, projectId)
        if cloud_url:
            return {"url": cloud_url, "storage": "cloudinary"}

        s3_url = _upload_to_s3(content, filename, content_type, projectId)
        if s3_url:
            return {"url": s3_url, "storage": "s3"}

        local_url = _upload_to_local_static(content, filename, projectId, static_dir)
        return {"url": local_url, "storage": "local"}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Cloud upload failed: {str(e)}") from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}") from e

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
    try:
        res = AsyncResult(taskId, app=celery_app)
        celery_state = res.state
    except Exception as exc:
        return {
            "status": "failed",
            "progress": 0,
            "step": None,
            "elapsedSec": None,
            "videoUrl": None,
            "error": f"Render task state unreadable ({exc}). Submit a new render.",
        }

    status_mapping = {
        "PENDING": "pending",
        "STARTED": "in_progress",
        "PROGRESS": "in_progress",
        "SUCCESS": "complete",
        "FAILURE": "failed",
    }

    state = status_mapping.get(celery_state, "pending")
    progress = 0
    step = None
    elapsed_sec = None
    video_url = None
    error_msg = None

    try:
        if celery_state == "SUCCESS":
            result = res.result
            if isinstance(result, dict):
                progress = result.get("progress", 100)
                video_url = result.get("videoUrl")
                state = result.get("status", "complete")
                error_msg = result.get("error")
            else:
                state = "complete"
                progress = 100
        elif celery_state == "PROGRESS" and isinstance(res.info, dict):
            progress = res.info.get("progress", 0)
            step = res.info.get("step")
            elapsed_sec = res.info.get("elapsed_sec")
        elif celery_state == "FAILURE":
            state = "failed"
            info = res.info
            if isinstance(info, dict):
                error_msg = info.get("error") or str(info.get("exc_message", info))
                step = info.get("step")
            else:
                error_msg = str(info) if info else "Render failed"
    except Exception as exc:
        state = "failed"
        error_msg = f"Could not read render result ({exc}). Submit a new render."

    return {
        "status": state,
        "progress": progress,
        "step": step,
        "elapsedSec": elapsed_sec,
        "videoUrl": video_url,
        "error": error_msg,
    }

@router.post("/video/render/{taskId}/cancel")
async def cancel_render(projectId: str, taskId: str):
    """Revoke an in-flight Celery render task."""
    celery_app.control.revoke(taskId, terminate=True)
    return {"status": "cancelled", "taskId": taskId}

app.include_router(router)

# Mount media static files directory to serve compiled video clips
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8003, reload=True)
