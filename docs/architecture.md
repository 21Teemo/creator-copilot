# Architecture Overview

Creator Copilot splits into a **Next.js frontend** and **four FastAPI microservices**, connected via a reverse proxy and Redis/Celery for async jobs.

## System Diagram

```
Next.js (:3000)  ──proxy──►  Research (:8001)   Stage 1
                 ──proxy──►  Scripting (:8002)  Stage 2
                 ──proxy──►  Media (:8003)     Stage 3  ──►  Redis ──►  Celery worker
                 ──proxy──►  SEO (:8004)       Stage 4
```

## Documentation

| Document | Scope |
|----------|-------|
| [Frontend Architecture](./frontend-architecture.md) | Next.js, UI stage layout, Zustand stores, API proxy consumption, polling |
| [Backend Architecture](./backend-architecture.md) | FastAPI microservices, Redis/Celery, integrations, orchestration |
| [Workflow](./workflow.md) | 4-stage creator pipeline and module-to-API mapping |
| [API Routing](./api-routing.md) | Full endpoint reference |

## Quick Reference — Ports

| Component | Port |
|-----------|------|
| Next.js Frontend | 3000 |
| Research Service | 8001 |
| Scripting Service | 8002 |
| Media Service | 8003 |
| SEO Service | 8004 |
| Redis | 6379 |

## Startup

```bash
./dev.sh          # backend: Redis + 4 services + Celery
npm run start     # frontend: localhost:3000
```
