import uvicorn
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from research.services.short import fetch_short_trends
from research.services.long import fetch_long_trends
from research.services.common import fetch_youtube_transcript
from research.services.gemini import perform_web_search, perform_summarization

app = FastAPI(title="Creator Copilot - Research Service", version="0.1.0")

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

class ResearchRequest(BasePayload):
    prompt: str
    minViews: Optional[int] = None
    uploadWithinHours: Optional[int] = 720
    sortBy: Optional[str] = "virality"

class TrendItem(BaseModel):
    title: str
    views: str
    rawViews: Optional[int] = None
    duration: str
    description: str
    channelName: str
    publishedAt: str
    videoUrl: Optional[str] = None
    thumbnailUrl: Optional[str] = None
    likes: Optional[int] = None
    comments: Optional[int] = None
    subscriberCount: Optional[int] = None
    commentVelocity: Optional[float] = None
    subscriberGap: Optional[float] = None
    viralityScore: Optional[float] = None
    trendExplanation: Optional[str] = None

class WebSearchResponse(BaseModel):
    sources: List[dict]

class SummarizeResponse(BaseModel):
    summaryText: str
    sources: List[dict]

router = APIRouter(prefix="/api/v1/projects/{projectId}/research")

@router.post("/trends/short", response_model=List[TrendItem])
async def get_short_trends(projectId: str, payload: ResearchRequest):
    query = payload.prompt
    # For shorts, disable the age filter by default (when it is 720 or not specified)
    # to allow popular Shorts to be resolved regardless of upload age
    upload_hours = payload.uploadWithinHours
    if upload_hours == 720:
        upload_hours = None

    trends = fetch_short_trends(
        query=query,
        min_views=payload.minViews if payload.minViews is not None else 1000,
        upload_within_hours=upload_hours,
        sort_by=payload.sortBy or "virality"
    )
    return trends

@router.post("/trends/long", response_model=List[TrendItem])
async def get_long_trends(projectId: str, payload: ResearchRequest):
    query = payload.prompt
    trends = fetch_long_trends(
        query=query,
        min_views=payload.minViews if payload.minViews is not None else 5000,
        upload_within_hours=payload.uploadWithinHours if payload.uploadWithinHours is not None else 720,
        sort_by=payload.sortBy or "virality"
    )
    return trends

@router.post("/web-search", response_model=WebSearchResponse)
async def web_search(projectId: str, payload: ResearchRequest):
    query = payload.prompt
    if "youtube.com/" in query or "youtu.be/" in query:
        transcript = fetch_youtube_transcript(query)
        return {
            "sources": [
                {
                    "title": "YouTube Video Transcript",
                    "url": query,
                    "snippet": transcript[:400] + "..."
                }
            ]
        }
    
    results = perform_web_search(query)
    return results

@router.post("/summarize", response_model=SummarizeResponse)
async def summarize(projectId: str, payload: ResearchRequest):
    query = payload.prompt
    if "youtube.com/" in query or "youtu.be/" in query:
        transcript = fetch_youtube_transcript(query)
        content_to_summarize = f"Video URL: {query}\nTranscript:\n{transcript}"
        results = perform_summarization(content_to_summarize)
        results["sources"] = [{"title": "YouTube Video Source", "url": query}]
        return results
        
    results = perform_summarization(query)
    return results

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
