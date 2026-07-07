# Storage Platform

Production-grade, self-hosted S3 Storage Management Platform compatible with **Garage**, AWS S3, MinIO, and Cloudflare R2.

## Architecture

```
Browser → Next.js → NestJS API → AWS SDK v3 → Garage S3
```

All storage operations go through the S3 API only. The application never accesses Garage's internal database or filesystem.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TailwindCSS, shadcn/ui, TanStack Query/Table |
| Backend | NestJS, Prisma, PostgreSQL, Redis, BullMQ |
| Storage | AWS SDK v3 S3Client → Garage |
| Auth | JWT + Refresh Tokens, RBAC |
| Deploy | Docker Compose |

## Quick Start

### Prerequisites

- Bun 1.2+
- Docker & Docker Compose

Garage S3 is included in the local Docker stack (`dxflrs/garage`). No separate Garage install is required for development.

### Development Setup

```bash
# Copy environment file
cp .env.example .env
# Edit .env with your Garage S3 credentials

# Start infrastructure and setup
chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh

# Start dev servers
bun dev
```

**Default admin credentials:** `admin@storage.local` / `Admin123!`

### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000/api/v1 |
| Swagger Docs | http://localhost:4000/api/docs |
| Health Check | http://localhost:4000/api/v1/health |
| Garage S3 | http://localhost:3900 |

## Project Structure

```
├── frontend/          # Next.js 15 application
├── backend/           # NestJS API server
├── packages/shared/   # Shared types, Zod schemas, permissions
├── docker/            # Dockerfiles and Compose configs
├── docs/              # Documentation
├── scripts/           # Setup and deployment scripts
├── infra/             # Infrastructure configs
└── .github/           # CI/CD workflows
```

## Features

- **Authentication** — Login, logout, refresh tokens, RBAC with 5 system roles
- **Bucket Management** — Create, delete, configure versioning, CORS, tags
- **Object Explorer** — Table/grid views, breadcrumbs, drag-and-drop upload
- **Upload** — Simple and multipart upload with queue and progress
- **Download** — Single file and bulk ZIP download
- **Search** — Global and bucket-scoped object search
- **Sharing** — Presigned URLs and share links with expiration
- **Dashboard** — Storage stats, activity feed, analytics
- **Admin** — User/role management, system health, audit logs
- **Notifications** — Toast and notification center

## Documentation

See the [docs/](docs/) directory for detailed guides:

- [Architecture](docs/Architecture.md)
- [API Reference](docs/API.md)
- [External Integration](docs/INTEGRATION.md)
- [Installation](docs/Installation.md)
- [Deployment](docs/Deployment.md)
- [Development](docs/Development.md)
- [Environment Variables](docs/EnvironmentVariables.md)
- [Permission System](docs/PermissionSystem.md)

## License

Private — All rights reserved.
