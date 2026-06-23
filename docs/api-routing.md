# API Routing Map

All endpoints are scoped under a project:

```
/api/v1/projects/:projectId/<domain>/<action>
```

The Next.js frontend calls these paths on `localhost:3000`. `next.config.ts` proxies each path to the correct FastAPI service.

Endpoints are grouped below by **creator workflow stage**.

---

## Stage 1 — Pre-Concept & Research

**Service:** `http://127.0.0.1:8001`

### Fact Finding & web-search

`POST /api/v1/projects/:projectId/research/web-search`

- `youtube_transcript_api` — `YouTubeTranscriptApi().fetch()` for real transcripts
- **Gemini API** — LLM synthesis when `GEMINI_API_KEY` is set in `services/research/.env`

### Article & Document Summarizer

`POST /api/v1/projects/:projectId/research/summarize`

- Gemini-backed synthesis of transcripts, articles, and research into creator briefs

### Brainstorming & Niche Trends

`POST /api/v1/projects/:projectId/research/trends/short`

- `yt-dlp` → `ytsearch5: [niche] #shorts`
- Extracts titles, views, durations, real descriptions

`POST /api/v1/projects/:projectId/research/trends/long`

- `yt-dlp` → `ytsearch5: [niche] trends 2024`
- Extracts real long-form video metadata

---

## Stage 2 — Planning & Scripting

**Service:** `http://127.0.0.1:8002`

### Hook & Outline Designer / Voice-over Script Drafter

`POST /api/v1/projects/:projectId/scripting/storyboard`

- Generates hook, outline, narration script, and visual storyboard from Stage 1 research

### Visual & Thumbnail Concept Art

`POST /api/v1/projects/:projectId/thumbnails/:assetId/grade`

- Grades thumbnail concepts for CTR potential
- `:assetId` — specific thumbnail asset within the project

---

## Stage 3 — Media Generation

**Service:** `http://127.0.0.1:8003` + Celery worker

### Stock Sourcing Search

`POST /api/v1/projects/:projectId/stock/search`

- Searches stock image libraries (Unsplash, Pixabay) for pictures matching project context

`POST /api/v1/projects/:projectId/stock/videos`

- Searches stock video libraries (Pexels, Pixabay) for video clips matching project context

### Thumbnail Builder (FLUX / Imagen)

Image generation handled within the Media service pipeline (no dedicated public endpoint yet).

### ElevenLabs Voice Synthesis

VO synthesis integrated in the render pipeline (ElevenLabs API).

### FFmpeg Video Compilation Engine

`POST /api/v1/projects/:projectId/video/render`

- Dispatches async Celery render task → returns `taskId`

`GET /api/v1/projects/:projectId/video/render/:taskId/status`

- Polls task state until render completes

---

## Stage 4 — SEO & Publishing

**Service:** `http://127.0.0.1:8004`

### High-CTR Title Optimizer

`POST /api/v1/projects/:projectId/seo/titles`

- Generates optimized YouTube title candidates

### Chapter/Timestamp Outliner

`POST /api/v1/projects/:projectId/seo/metadata`

- Description, tags, chapter timestamps

### Auto-draft Upload to YouTube API

`POST /api/v1/projects/:projectId/publish`

- Pushes video + metadata as YouTube draft; handles billing integrations

---

## Proxy Summary

| Path prefix | Target |
|-------------|--------|
| `/api/v1/projects/:projectId/research/*` | `:8001` Research |
| `/api/v1/projects/:projectId/scripting/*` | `:8002` Scripting |
| `/api/v1/projects/:projectId/thumbnails/*` | `:8002` Scripting |
| `/api/v1/projects/:projectId/stock/*` | `:8003` Media |
| `/api/v1/projects/:projectId/video/*` | `:8003` Media |
| `/api/v1/projects/:projectId/seo/*` | `:8004` SEO |
| `/api/v1/projects/:projectId/publish` | `:8004` SEO |

> All routes aligned and audited between `next.config.ts` and FastAPI service routers.

---

## Endpoint Checklist

| Stage | Method | Endpoint | Async |
|-------|--------|----------|-------|
| 1 | POST | `/research/trends/short` | No |
| 1 | POST | `/research/trends/long` | No |
| 1 | POST | `/research/web-search` | No |
| 1 | POST | `/research/summarize` | No |
| 2 | POST | `/scripting/storyboard` | No |
| 2 | POST | `/thumbnails/:assetId/grade` | No |
| 3 | POST | `/stock/search` | No |
| 3 | POST | `/stock/videos` | No |
| 3 | POST | `/video/render` | **Yes** (Celery) |
| 3 | GET | `/video/render/:taskId/status` | — (poll) |
| 4 | POST | `/seo/titles` | No |
| 4 | POST | `/seo/metadata` | No |
| 4 | POST | `/publish` | No |

*All paths relative to `/api/v1/projects/:projectId`.*
