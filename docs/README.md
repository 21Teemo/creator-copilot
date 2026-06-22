# Creator Copilot — Documentation

A modular SaaS platform that acts as a **YouTube Creator Copilot** — guiding creators through four stages from pre-concept research to YouTube publish.

## Creator Pipeline

```
1. Pre-Concept & Research
       ↓
2. Planning & Scripting
       ↓
3. Media Generation
       ↓
4. SEO & Publishing
```

| Stage | Modules | Backend |
|-------|---------|---------|
| **1. Pre-Concept & Research** | Fact Finding & web-search · Article & Document Summarizer · Brainstorming & Niche Trends | Research `:8001` |
| **2. Planning & Scripting** | Hook & Outline Designer · Voice-over Script Drafter · Visual & Thumbnail Concept Art | Scripting `:8002` |
| **3. Media Generation** | Thumbnail Builder (FLUX / Imagen) · ElevenLabs Voice Synthesis · FFmpeg Video Compilation Engine | Media `:8003` + Celery |
| **4. SEO & Publishing** | High-CTR Title Optimizer · Chapter/Timestamp Outliner · Auto-draft Upload to YouTube API | SEO `:8004` |

→ Full stage breakdown, module-to-API mapping, and flow diagram: **[Workflow](./workflow.md)**

## Documentation Index

| Document | Description |
|----------|-------------|
| [Workflow](./workflow.md) | 4-stage creator pipeline, modules, and API mapping |
| [Frontend Architecture](./frontend-architecture.md) | Flow studio UI, Pipeline Navigation, Content Format, UX enhancements |
| [Visual Design](./visual-design.md) | Color palette, typography, component specs, Tailwind tokens |
| [Backend Architecture](./backend-architecture.md) | FastAPI microservices, Redis/Celery, integrations, `dev.sh` |
| [Architecture Overview](./architecture.md) | High-level system diagram and port reference |
| [API Routing](./api-routing.md) | Full endpoint map with proxy rules, ports, and implementation notes |

## Quick Start

```bash
# From project root — starts Redis, all 4 FastAPI services, and the Celery worker
./dev.sh

# Frontend (production mode recommended for stability)
npm run start   # http://localhost:3000
```

### Service Ports

| Service | Port |
|---------|------|
| Next.js Frontend | 3000 |
| Research Service | 8001 |
| Scripting Service | 8002 |
| Media Service | 8003 |
| SEO Service | 8004 |
| Redis | 6379 |

## Project Layout (Expected)

```
creator-copilot/
├── dev.sh                          # Orchestration startup script
├── next.config.ts                  # API reverse-proxy to microservices
├── frontend/                       # Next.js 16 App Router
│   └── stores/                     # Zustand stores (e.g. useResearchStore.ts)
├── services/
│   ├── research/                   # Stage 1 — port 8001
│   ├── scripting/                  # Stage 2 — port 8002
│   ├── media/                      # Stage 3 — port 8003
│   ├── seo/                        # Stage 4 — port 8004
│   └── video-worker/               # Celery worker (worker.py)
└── docs/                           # This documentation
```

## Environment

- **Research Service**: `services/research/.env` — set `GEMINI_API_KEY` for LLM synthesis.
- **Media Service**: ElevenLabs API key for voice synthesis; FLUX/Imagen credentials for thumbnail generation.
- Each microservice runs in its own isolated Python `venv`.
