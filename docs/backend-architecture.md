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

## Technology Stack & Communication

| Component | Technology | Version / Spec | Role |
| **Runtime Environment** | **Python** | `3.12.x` | Base runtime for all backend microservices and celery workers |
| **API Framework** | **FastAPI** | `^0.138.0` | ASGI framework for building high-performance REST APIs |
| **Data Validation** | **Pydantic v2** | `^2.13.0` | JSON request/response schema parsing and type-safety validation |
| **ASGI Server** | **Uvicorn** | `^0.49.0` | High-speed server running service processes on ports 8001–8004 |
| **Task Queue** | **Celery** | `^5.6.0` | Asynchronous task execution for video compile rendering |
| **Message Broker** | **Redis** | `^8.0` | Message broker and task result backend for Celery (port 6379) |
| **Media Synthesis** | **MoviePy** | `^2.0.0` | Python library for video editing, compositing, and timeline alignment (FFmpeg wrapper) |
| **Media Processing** | **FFmpeg** | `^8.1` (libx264, aac) | CLI compiler engine for video, audio, and graphics compilation |

### Media Synthesis & Processing Details (FFmpeg & MoviePy)

To achieve maximum performance and stability during automated video compilation:
- **FFmpeg 8.1 "Hoare"** is designated as the primary compiler engine. This version introduces key optimizations:
  - **Native GPU Compute Acceleration**: Leverages Vulkan compute shaders and D3D12 compute contexts for high-speed hardware-accelerated encoding/decoding, substantially reducing Celery worker render times.
  - **Advanced AV1 Support**: Improves encoding efficiency and quality for AV1 outputs, which is highly recommended for modern YouTube uploads.
  - **Integrated Audio Filters**: Native support for advanced filters (e.g., experimental xHE-AAC, Ambisonic audio elements) that ensure audio normalization and synthetic voice blending remain crystal clear.
- **MoviePy Integration**:
  - Since MoviePy wraps around FFmpeg subprocess commands, the path to the system-installed FFmpeg 8.1 binary must be explicitly configured in the container runtime environment by setting the `FFMPEG_BINARY` environment variable (e.g., `os.environ["FFMPEG_BINARY"] = "/usr/bin/ffmpeg"`). This avoids fallback to default downloaded older binaries from package dependencies.
  - **Modern Imports**: MoviePy v2.0 completely removes the legacy `moviepy.editor` module. Code must import modules directly from the root namespace:
    ```python
    # Correct (MoviePy 2.0+)
    from moviepy import VideoFileClip, AudioFileClip, CompositeVideoClip
    
    # Incorrect (Deprecated in 2.0+)
    # from moviepy.editor import VideoFileClip
    ```


### Communication Protocols


#### 1. Frontend-to-Backend Proxy Gateway
- The browser clients send all requests directly to the Next.js gateway running on port `3000`/`3030`.
- Next.js route proxies redirect these requests to local FastAPI ports (`8001`–`8004`) based on path matching (see [api-routing.md](./api-routing.md)).
- Ensures all cross-origin Resource Sharing (CORS) concerns are eliminated.

#### 2. Stateless Inter-Service Communication
- Backend services are fully **decoupled and stateless**; they do not trigger network requests directly to one another.
- The Next.js frontend acts as the central coordinator (using Zustand stores). Data generated by one stage (e.g., script narration) is passed explicitly in request payloads of the next stage (e.g., thumbnail grader or video renderer).
- This guarantees microservices can scale independently without cascade-failure bottlenecks.

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

**Env:** `services/.env` — `DEEPSEEK_API_KEY`

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
│   ├── .env                  # DEEPSEEK_API_KEY
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
