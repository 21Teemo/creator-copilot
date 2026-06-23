# Backend Architecture & Design

## Overview

The backend is a **decoupled, event-driven microservices** stack written in Python (FastAPI). Four services map 1:1 to the creator workflow stages. Heavy work (video rendering) is offloaded to a Celery worker via Redis.

```
                    ┌──────────────────────────────────────┐
                    │         Next.js proxy (:3000)        │
                    │   /api/v1/projects/:projectId/*      │
                    └──────┬─────────┬─────────┬───────────┘
                           │         │         │
                     :8001 │   :8002 │   :8003 │   :8004
                           ▼         ▼         ▼         ▼
                    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
                    │ Research │ │Scripting │ │  Media   │ │   SEO    │
                    │ FastAPI  │ │ FastAPI  │ │ FastAPI  │ │ FastAPI  │
                    └──────────┘ └──────────┘ └────┬─────┘ └──────────┘
                                                   │
                                                   │ enqueue
                                                   ▼
                                            ┌─────────────┐
                                            │    Redis    │ :6379
                                            └──────┬──────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │   Celery    │
                                            │video-worker │
                                            └─────────────┘
```

---

## Design Principles

- **One service per stage** — Research, Scripting, Media, SEO are independently deployable.
- **Sync API, async jobs** — FastAPI returns immediately; Celery handles renders.
- **Isolated environments** — each service has its own `venv` and `.env`.
- **Project-scoped routes** — all endpoints under `/api/v1/projects/:projectId/`.

---

## Microservices

Each service runs via **uvicorn** in its own directory under `services/`.

| Service | Port | Stage | Responsibility |
|---------|------|-------|----------------|
| **Research** | 8001 | 1 | Web-search, transcript extraction, niche trends, summarization |
| **Scripting** | 8002 | 2 | Storyboard, hooks, VO script, thumbnail concept grading |
| **Media** | 8003 | 3 | Stock search, thumbnail gen, voice synthesis, video render orchestration |
| **SEO** | 8004 | 4 | CTR titles, metadata/chapters, YouTube draft publish |

### Research Service (`services/research/`)

| Module | Endpoint | Integration |
|--------|----------|-------------|
| Fact Finding & web-search | `POST /research/web-search` | `youtube_transcript_api`, Gemini |
| Article & Document Summarizer | `POST /research/summarize` | Gemini |
| Brainstorming & Niche Trends | `POST /research/trends/short`, `/trends/long` | `yt-dlp` (`ytsearch5:`) |

**Env:** `services/research/.env` — `GEMINI_API_KEY`

### Scripting Service (`services/scripting/`)

| Module | Endpoint |
|--------|----------|
| Hook & Outline / VO Script / Storyboard | `POST /scripting/storyboard` |
| Thumbnail Concept Art grading | `POST /thumbnails/:assetId/grade` |

### Media Service (`services/media/`)

| Stock image search | `POST /stock/search` | Unsplash / Pixabay APIs |
| Stock video search | `POST /stock/videos` | Pexels / Pixabay APIs |
| Thumbnail Builder | (render pipeline) | FLUX / Imagen |
| Voice Synthesis | (render pipeline) | ElevenLabs API |
| FFmpeg Video Compilation | `POST /video/render`, `GET /video/render/:taskId/status` | Celery + FFmpeg |

**Env:** ElevenLabs key, image-gen credentials

### SEO Service (`services/seo/`)

| Module | Endpoint |
|--------|----------|
| High-CTR Title Optimizer | `POST /seo/titles` |
| Chapter/Timestamp Outliner | `POST /seo/metadata` |
| YouTube draft upload | `POST /publish` |

---

## Background Task Processing

| Component | Location | Role |
|-----------|----------|------|
| **Redis** | `localhost:6379` | Celery message broker |
| **Celery worker** | `services/video-worker/worker.py` | FFmpeg render, heavy media jobs |

### Render flow

```
Client                Media Service              Redis/Celery
  │                        │                         │
  │ POST /video/render     │                         │
  ├───────────────────────►│ validate + enqueue      │
  │                        ├────────────────────────►│
  │◄───────────────────────┤ { taskId }              │
  │                        │                         │ FFmpeg render...
  │ GET /status/:taskId    │                         │
  ├───────────────────────►│ query task state        │
  │◄───────────────────────┤ { status, result }    │
```

1. Media service validates payload, dispatches Celery task, returns `taskId`.
2. Worker pulls job from Redis, runs FFmpeg pipeline (stock + VO + graphics).
3. Status endpoint reads Celery result backend until terminal state.

---

## Orchestration

`./dev.sh` starts the full backend stack:

1. Redis (`:6379`)
2. Research — `uvicorn` on `:8001`
3. Scripting — `uvicorn` on `:8002`
4. Media — `uvicorn` on `:8003`
5. SEO — `uvicorn` on `:8004`
6. Celery video worker

Frontend is started separately: `npm run start` on `:3000`.

---

## Expected Directory Layout

```
services/
├── research/
│   ├── venv/
│   ├── .env                  # GEMINI_API_KEY
│   └── app/                  # FastAPI routers
├── scripting/
│   ├── venv/
│   └── app/
├── media/
│   ├── venv/
│   ├── .env                  # ElevenLabs, image-gen keys
│   └── app/
├── seo/
│   ├── venv/
│   └── app/
└── video-worker/
    ├── venv/
    └── worker.py             # Celery app + FFmpeg tasks
```

---

## API Contract

- **Base path:** `/api/v1/projects/:projectId`
- **Auth:** TBD (project-scoped; add middleware per deployment)
- **Error shape:** Consistent JSON `{ detail: string }` across services (FastAPI default)

### Base Payload Wrapper
Every POST request sent by the frontend automatically includes the following global context fields:
```json
{
  "contentFormat": "long" | "short",
  "includeAudio": boolean
}
```

### JSON Request / Response Schemas

#### 1. Research Service (`:8001`)
* **`POST /research/trends/short` & `POST /research/trends/long`**
  - **Request Body**: `{ "prompt": string }`
  - **Response Body**: `TrendItem[]` where `TrendItem` is:
    ```json
    {
      "title": string,
      "views": string,
      "duration": string,
      "description": string,
      "channelName": string,
      "publishedAt": string
    }
    ```
* **`POST /research/summarize`**
  - **Request Body**: `{ "prompt": string }`
  - **Response Body**:
    ```json
    {
      "summaryText": string,
      "sources": [
        {
          "title": string,
          "url": string,
          "snippet": string // optional
        }
      ]
    }
    ```
* **`POST /research/web-search`**
  - **Request Body**: `{ "prompt": string }`
  - **Response Body**:
    ```json
    {
      "sources": [
        {
          "title": string,
          "url": string,
          "snippet": string // optional
        }
      ]
    }
    ```

#### 2. Scripting Service (`:8002`)
* **`POST /scripting/storyboard`**
  - **Request Body**: `{ "prompt": string }`
  - **Response Body**:
    ```json
    {
      "script": string,
      "outline": [
        {
          "sectionTitle": string,
          "durationSeconds": number,
          "talkingPoints": string[]
        }
      ],
      "storyboard": [
        {
          "sceneNumber": number,
          "visualPrompt": string,
          "narrationText": string
        }
      ]
    }
    ```
* **`POST /thumbnails/:assetId/grade`**
  - **Request Body**: `{ "prompt": string, "imageUrl": string }`
  - **Response Body**:
    ```json
    {
      "ctrScore": number, // 0 to 100
      "feedback": string
    }
    ```

#### 3. Media Service (`:8003`)
* **`POST /stock/search`** (Images search)
  - **Request Body**: `{ "prompt": string }`
  - **Response Body**:
    ```json
    [
      {
        "sceneNumber": number,
        "imageUrl": string,
        "visualPrompt": string
      }
    ]
    ```
* **`POST /stock/videos`** (Video search)
  - **Request Body**: `{ "prompt": string }`
  - **Response Body**:
    ```json
    [
      {
        "sceneNumber": number,
        "videoUrl": string,
        "visualPrompt": string
      }
    ]
    ```
* **`POST /video/render`**
  - **Request Body**:
    ```json
    {
      "storyboard": [
        {
          "sceneNumber": number,
          "visualPrompt": string,
          "narrationText": string
        }
      ]
    }
    ```
  - **Response Body**: `{ "taskId": string }`
* **`GET /video/render/:taskId/status`**
  - **Response Body**:
    ```json
    {
      "status": "idle" | "pending" | "in_progress" | "complete" | "failed",
      "progress": number, // 0 to 100
      "videoUrl": string | null
    }
    ```

#### 4. SEO Service (`:8004`)
* **`POST /seo/titles`**
  - **Request Body**: `{}`
  - **Response Body**: `{ "titles": string[] }`
* **`POST /seo/metadata`**
  - **Request Body**: `{}`
  - **Response Body**:
    ```json
    {
      "description": string,
      "tags": string[],
      "chapters": [
        {
          "timestamp": string,
          "title": string
        }
      ]
    }
    ```
* **`POST /publish`**
  - **Request Body**:
    ```json
    {
      "title": string,
      "description": string,
      "tags": string[],
      "videoUrl": string,
      "thumbnailUrl": string
    }
    ```
  - **Response Body**: `{ "publishedUrl": string }`

Full route map: [API Routing](./api-routing.md)

---

## Scalability

| Concern | Approach |
|---------|----------|
| Render throughput | Scale Celery workers horizontally; Redis as shared broker |
| API latency | Keep FastAPI handlers thin; never block on FFmpeg |
| Service isolation | Deploy/scale Research, Scripting, Media, SEO independently |
| Env config | Per-service `.env`; no shared secrets file |

---

## External Integrations Summary

| Integration | Used by | Purpose |
|-------------|---------|---------|
| `yt-dlp` | Research | Live YouTube search + metadata |
| `youtube_transcript_api` | Research | Transcript extraction |
| Gemini API | Research | LLM synthesis / summarization |
| FLUX / Imagen | Media | Thumbnail image generation |
| ElevenLabs | Media | Text-to-speech for VO |
| FFmpeg | Celery worker | Video compilation |
| Pexels & Pixabay | Media | Stock image & video clip sourcing |
| YouTube API | SEO | Draft upload / publish |
