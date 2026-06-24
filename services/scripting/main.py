import uvicorn
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from scripting.services.gemini import generate_storyboard, grade_thumbnail, StoryboardOutput, GradingOutput

app = FastAPI(title="Creator Copilot - Scripting Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class BasePayload(BaseModel):
    contentFormat: Optional[str] = "long"
    includeAudio: Optional[bool] = False

class ScriptRequest(BasePayload):
    prompt: str

class GradeRequest(BasePayload):
    prompt: str
    imageUrl: str

router = APIRouter(prefix="/api/v1/projects/{projectId}")

@router.post("/scripting/storyboard", response_model=StoryboardOutput)
async def get_storyboard(projectId: str, payload: ScriptRequest):
    format_type = payload.contentFormat or "long"
    result = generate_storyboard(payload.prompt, format_type)
    return result

@router.post("/thumbnails/{assetId}/grade", response_model=GradingOutput)
async def do_grading(projectId: str, assetId: str, payload: GradeRequest):
    result = grade_thumbnail(payload.prompt, payload.imageUrl)
    return result

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8002, reload=True)
