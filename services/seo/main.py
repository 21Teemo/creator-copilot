import uvicorn
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from seo.services.gemini import generate_seo_titles, generate_seo_metadata
from seo.services.youtube_draft import publish_draft

app = FastAPI(title="Creator Copilot - SEO Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SeoPayload(BaseModel):
    script: Optional[str] = ""
    contentFormat: Optional[str] = "long"
    includeAudio: Optional[bool] = True

class PublishPayload(BaseModel):
    contentFormat: Optional[str] = "long"
    includeAudio: Optional[bool] = True

router = APIRouter(prefix="/api/v1/projects/{projectId}")

@router.post("/seo/titles")
async def get_seo_titles(projectId: str, payload: SeoPayload):
    prompt_source = payload.script or f"Project {projectId}"
    titles_data = generate_seo_titles(prompt_source)
    return titles_data

@router.post("/seo/metadata")
async def get_seo_metadata(projectId: str, payload: SeoPayload):
    prompt_source = payload.script or f"Project {projectId}"
    metadata = generate_seo_metadata(prompt_source)
    return metadata

@router.post("/publish")
async def publish_video_draft(projectId: str, payload: PublishPayload):
    try:
        # Construct publication context
        result = publish_draft(projectId, payload.model_dump())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to publish YouTube draft: {str(e)}")

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8004, reload=True)
