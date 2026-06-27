import uvicorn
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from research.services.short import fetch_short_trends
from research.services.long import fetch_long_trends
from research.services.common import fetch_youtube_transcript, fetch_trend_explanation_lazy
from research.services.heatmap import fetch_engagement_segments_lazy
from research.services.gemini import perform_web_search, perform_summarization, analyze_trend_thumbnail

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
    sortBy: Optional[str] = "breakout"
    thumbnailUrl: Optional[str] = None
    videoTitle: Optional[str] = None
    videoDescription: Optional[str] = None
    visualAnalysis: Optional[str] = None

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
    durationSeconds: Optional[int] = None
    engagementSegments: Optional[List[dict]] = None
    heatmapAvailable: Optional[bool] = None

class WebSearchResponse(BaseModel):
    sources: List[dict]

class SummarizeResponse(BaseModel):
    summaryText: str
    sources: List[dict]
    visualAnalysis: Optional[str] = None

class TrendExplainRequest(BaseModel):
    title: str
    description: str
    channelName: str
    videoUrl: str

class TrendExplainResponse(BaseModel):
    explanation: str

class EngagementSegment(BaseModel):
    start: int
    end: int
    startLabel: str
    endLabel: str
    score: float

class TrendEngagementRequest(BaseModel):
    videoUrl: str
    durationSeconds: Optional[int] = None
    contentFormat: Optional[str] = "short"
    rawViews: Optional[int] = None
    likes: Optional[int] = None
    comments: Optional[int] = None

class TrendEngagementResponse(BaseModel):
    heatmapAvailable: bool
    source: str
    segments: List[EngagementSegment]

class TrendVisualAnalyzeRequest(BaseModel):
    thumbnailUrl: str
    title: Optional[str] = ""
    description: Optional[str] = ""

class TrendVisualAnalyzeResponse(BaseModel):
    analysis: str

router = APIRouter(prefix="/api/v1/projects/{projectId}/research")

@router.post("/trends/short", response_model=List[TrendItem])
async def get_short_trends(projectId: str, payload: ResearchRequest):
    query = payload.prompt or ""
    try:
        trends = fetch_short_trends(
            query=query,
            min_views=payload.minViews if payload.minViews is not None else 1000,
            sort_by=payload.sortBy or "breakout",
        )
        return trends
    except Exception as e:
        print(f"[trends/short] Unhandled error: {e}")
        raise HTTPException(status_code=500, detail=f"Trend search failed: {e}")

@router.post("/trends/long", response_model=List[TrendItem])
async def get_long_trends(projectId: str, payload: ResearchRequest):
    query = payload.prompt
    trends = fetch_long_trends(
        query=query,
        min_views=payload.minViews if payload.minViews is not None else 5000,
        sort_by=payload.sortBy or "breakout"
    )
    return trends

@router.post("/trends/explain", response_model=TrendExplainResponse)
async def explain_trend(projectId: str, payload: TrendExplainRequest):
    if not payload.videoUrl:
        raise HTTPException(status_code=400, detail="videoUrl is required")

    explanation = fetch_trend_explanation_lazy(
        payload.title,
        payload.description,
        payload.channelName,
        payload.videoUrl,
    )
    return {"explanation": explanation}

@router.post("/trends/engagement", response_model=TrendEngagementResponse)
async def trend_engagement(projectId: str, payload: TrendEngagementRequest):
    if not payload.videoUrl:
        raise HTTPException(status_code=400, detail="videoUrl is required")

    is_short = (payload.contentFormat or "short") == "short"
    result = fetch_engagement_segments_lazy(
        video_url=payload.videoUrl,
        duration_seconds=payload.durationSeconds,
        is_short=is_short,
        view_count=payload.rawViews,
        like_count=payload.likes,
        comment_count=payload.comments,
    )
    return result

@router.post("/trends/visual-analyze", response_model=TrendVisualAnalyzeResponse)
async def analyze_trend_visual(projectId: str, payload: TrendVisualAnalyzeRequest):
    if not payload.thumbnailUrl:
        raise HTTPException(status_code=400, detail="thumbnailUrl is required")
    analysis = analyze_trend_thumbnail(
        payload.thumbnailUrl,
        payload.title or "",
        payload.description or "",
    )
    return {"analysis": analysis}

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
    try:
        visual_analysis = (payload.visualAnalysis or "").strip()
        if payload.thumbnailUrl and not visual_analysis:
            visual_analysis = analyze_trend_thumbnail(
                payload.thumbnailUrl,
                payload.videoTitle or "",
                payload.videoDescription or "",
            ).strip()

        query = payload.prompt
        if "youtube.com/" in query or "youtu.be/" in query:
            transcript = fetch_youtube_transcript(query)
            content_to_summarize = f"Video URL: {query}\nTranscript:\n{transcript}"
            if visual_analysis:
                content_to_summarize += (
                    "\n\n=== VISUAL STYLE ANALYSIS (from thumbnail — replicate this format) ===\n"
                    + visual_analysis
                )
            results = perform_summarization(content_to_summarize, visual_analysis=visual_analysis)
            results["sources"] = [{"title": "YouTube Video Source", "url": query}]
            if visual_analysis:
                results["visualAnalysis"] = visual_analysis
            return results

        if visual_analysis:
            query += (
                "\n\n=== VISUAL STYLE ANALYSIS (from thumbnail — replicate this format) ===\n"
                + visual_analysis
            )

        results = perform_summarization(query, visual_analysis=visual_analysis)
        if visual_analysis:
            results["visualAnalysis"] = visual_analysis
        return results
    except Exception as e:
        print(f"[summarize] Unhandled error: {e}")
        raise HTTPException(status_code=500, detail=f"Summarize failed: {e}")

app.include_router(router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8001, reload=True)
