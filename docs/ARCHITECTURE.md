# Architecture

## Overview

The Storage Platform is an enterprise-grade S3-compatible storage management system. It provides a modern web interface for managing buckets, objects, uploads, sharing, and analytics — communicating exclusively through the S3 API.

## System Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Browser   │────▶│   Next.js    │────▶│   NestJS    │────▶│  AWS SDK v3  │
│  (React 19) │     │  Frontend    │     │   Backend   │     │  S3Client    │
└─────────────┘     └──────────────┘     └──────┬──────┘     └──────┬───────┘
                                                 │                    │
                                          ┌──────┴──────┐             │
                                          │             │             │
                                     ┌────▼───┐  ┌─────▼──┐          │
                                     │Postgres│  │ Redis  │          │
                                     │ Prisma │  │ BullMQ │          │
                                     └────────┘  └────────┘          │
                                                                      │
                                                               ┌──────▼───────┐
                                                               │  Garage S3   │
                                                               │  (S3 API)    │
                                                               └──────────────┘
```

## Design Principles

- **Clean Architecture** — Feature-based modules with clear separation of concerns
- **S3 API Only** — Never access Garage internal APIs or filesystem
- **SOLID** — Single responsibility per service, dependency injection via NestJS
- **Production-Ready** — No placeholders, no TODOs, full error handling

## Backend Layers

### Infrastructure
- `database/` — Prisma ORM + PostgreSQL
- `redis/` — Caching and session storage
- `storage/` — S3Service wrapping AWS SDK v3
- `queue/` — BullMQ background job processing

### Feature Modules
Each module follows the pattern: `controller → service → infrastructure`

| Module | Responsibility |
|--------|---------------|
| auth | JWT authentication, refresh tokens, sessions |
| users | User CRUD, profile, device management |
| roles | RBAC roles and permission matrix |
| buckets | Bucket lifecycle via S3 API |
| objects | Object operations (list, copy, move, delete) |
| upload | Simple and multipart upload |
| download | Streaming download and ZIP archive |
| search | Object search across buckets |
| share | Share links and presigned URLs |
| activity | Audit trail and activity logs |
| dashboard | Statistics and overview |
| analytics | Storage analytics and trends |
| notifications | User notifications |
| admin | System administration |
| health | Health/readiness/liveness probes |
| settings | Global system settings |

## Frontend Architecture

```
src/
├── app/              # Next.js App Router pages
├── components/
│   ├── ui/           # shadcn/ui primitives
│   └── layout/       # Shell, sidebar, topbar
├── lib/              # API client, utilities
└── stores/           # Zustand state (auth, UI, upload)
```

## Data Flow

### Upload Flow
1. User drops files in explorer
2. Frontend queues upload in Zustand store
3. Files < 5MB: POST `/buckets/:name/upload`
4. Files ≥ 5MB: Multipart upload (initiate → parts → complete)
5. Backend calls S3 PutObject/UploadPart via AWS SDK
6. Activity logged, metrics recorded

### Authentication Flow
1. POST `/auth/login` with credentials
2. Backend validates, creates session + refresh token
3. JWT access token returned (15min expiry)
4. Frontend stores tokens, attaches Bearer header
5. On 401, auto-refresh via `/auth/refresh`

## Security

- Helmet HTTP headers
- CORS restricted to APP_URL
- Rate limiting (10/s, 50/10s, 200/min)
- Input validation (Zod + class-validator)
- bcrypt password hashing (12 rounds)
- JWT with configurable expiry
- RBAC permission guards on all endpoints
