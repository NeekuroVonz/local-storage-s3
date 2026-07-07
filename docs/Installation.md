# Installation

## Prerequisites

| Requirement | Version |
|------------|---------|
| Node.js | 20+ |
| Bun | 1.2+ |
| Docker | 24+ |
| Docker Compose | 2+ |
| Garage S3 | Latest |

## Step 1: Clone Repository

```bash
git clone <repository-url>
cd local-storage-s3
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Required
DATABASE_URL=postgresql://storage:storage@localhost:5432/storage_platform?schema=public
JWT_SECRET=your-secure-random-string-at-least-32-characters
S3_ENDPOINT=http://localhost:3900
S3_ACCESS_KEY_ID=your-garage-access-key
S3_SECRET_ACCESS_KEY=your-garage-secret-key
```

## Step 3: Start Infrastructure

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

This starts **PostgreSQL**, **Redis**, and **Garage S3** ([dxflrs/garage](https://hub.docker.com/r/dxflrs/garage)).

Or use the full setup script (recommended):

```bash
./scripts/dev-setup.sh
```

Garage runs single-node with a default bucket `storage` and credentials from `.env`.

## Step 4: Install & Setup

```bash
bun install
bun run --filter @storage/shared build
bun run db:generate
bun run db:migrate
bun run db:seed
```

## Step 5: Start Development

```bash
bun dev
```

## Verify Installation

1. Open http://localhost:3000
2. Login with `admin@storage.local` / `Admin123!`
3. Check http://localhost:4000/api/v1/health returns `{ "status": "ok" }`
4. Check http://localhost:4000/api/docs for Swagger UI
5. Check Garage: `docker exec storage-garage-dev /garage status`

## Garage S3 (Docker)

Local development includes Garage via Docker Compose. Configuration lives in `docker/garage/garage.toml`.

| Setting | Default (dev) |
|---------|----------------|
| S3 endpoint | http://localhost:3900 |
| Access key | `GK0011223344556677` |
| Secret key | `dev-storage-secret-key-change-in-production` |
| Default bucket | `storage` |

`./scripts/dev-setup.sh` writes these into `.env` automatically when placeholders are detected.

### Production / external Garage

To use an external Garage cluster instead of Docker, set `S3_*` in `.env` and remove or disable the `garage` service in Compose. Create keys with:

```bash
garage key create storage-platform-key
garage bucket create my-bucket
garage bucket allow --read --write --owner my-bucket --key storage-platform-key
```
