# Storage Platform

Production-grade, self-hosted S3 Storage Management Platform compatible with **Garage**, AWS S3, MinIO, and Cloudflare R2.

## Architecture

```
Browser → Next.js → NestJS API → AWS SDK v3 → Garage S3
```

Object bytes stay in S3. Platform features (auth, projects, FileId registry, folders, quotas, webhooks) use PostgreSQL.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, Tailwind CSS, TanStack Query |
| Backend | NestJS, Prisma, PostgreSQL, Redis, BullMQ |
| Storage | AWS SDK v3 → Garage (or any S3-compatible backend) |
| Auth | JWT + refresh tokens, RBAC |
| Deploy | Docker Compose |

## Quick Start (local)

### Prerequisites

- Bun 1.2+
- Docker & Docker Compose

### Setup

```bash
cp .env.example .env
# Local defaults already point at localhost Garage/Postgres/Redis

chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh
```

`dev-setup` starts Postgres + Redis + Garage, installs deps, builds `@storage/shared`, runs migrations + seed.

### Run

```bash
bun run dev
```

This syncs `.env` → `backend/.env`, builds the shared package if needed, then starts API + UI.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000/api/v1 |
| Swagger | http://localhost:4000/api/docs |
| Health | http://localhost:4000/api/v1/health |
| Garage S3 | http://localhost:3900 |

**Admin:** `admin@storage.local` / `Admin123!`

### If `bun run dev` fails

1. Infrastructure up?

```bash
docker compose -f docker/docker-compose.dev.yml ps
# Expect: storage-postgres-dev, storage-redis-dev, storage-garage-dev
```

2. Rebuild shared + migrate (after pulling new code):

```bash
bun install
bun run --filter @storage/shared build
bun run db:generate
bun run db:migrate
bun run dev
```

3. Port already in use?

```bash
lsof -ti :4000 | xargs kill -9
lsof -ti :3000 | xargs kill -9
```

4. Only start one side:

```bash
bun run dev:backend
bun run dev:frontend
```

## Features

- **Auth & RBAC** — JWT, roles, permissions; admin can create users and assign projects
- **Buckets & object explorer** — S3 list/upload/download/copy/move
- **Projects / multi-tenant** — buckets, API keys, grants, S3 credentials, webhooks, quotas
- **Files UI (`/files`)** — FileId upload, metadata, soft delete / trash / restore / purge
- **Folders UI (`/folders`)** — roots, project binding, search code/name, delete/rename if unused
- **Sharing, search, dashboard, audit**

See [docs/FILE_STORAGE.md](docs/FILE_STORAGE.md) for FileId APIs.

## Production (Ubuntu / Docker)

```bash
# On server: edit .env for IP + ports (see .env.example production comments)
./scripts/deploy.sh
```

Details: [docs/Deployment.md](docs/Deployment.md)

## Project Structure

```
├── frontend/           # Next.js UI
├── backend/            # NestJS API
├── packages/shared/    # Shared Zod schemas & types
├── docker/             # Compose + Dockerfiles + garage.toml
├── docs/               # Guides
└── scripts/            # dev-setup, deploy, sync-env
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [File Storage](docs/FILE_STORAGE.md)
- [Integration](docs/INTEGRATION.md)
- [Installation](docs/Installation.md)
- [Deployment](docs/Deployment.md)
- [Environment Variables](docs/EnvironmentVariables.md)
- [Roadmap](docs/ROADMAP.md)

## License

Private — All rights reserved.
