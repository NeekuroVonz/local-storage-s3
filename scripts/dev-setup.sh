#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

chmod +x "$ROOT_DIR/scripts/configure-garage-env.sh"
bash "$ROOT_DIR/scripts/configure-garage-env.sh"

# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/sync-env.sh"

echo "Starting development infrastructure (Postgres, Redis, Garage)..."
docker compose -f docker/docker-compose.dev.yml up -d

echo "Waiting for PostgreSQL..."
until docker exec storage-postgres-dev pg_isready -U storage -d storage_platform > /dev/null 2>&1; do
  sleep 1
done

echo "Waiting for Garage S3..."
until docker exec storage-garage-dev /garage status > /dev/null 2>&1; do
  sleep 2
done
echo "Garage is ready at http://localhost:3900"

# Re-sync after garage env may have been updated
bash "$ROOT_DIR/scripts/sync-env.sh"

echo "Installing dependencies..."
bun install

echo "Building shared package..."
bun run --filter @storage/shared build

echo "Generating Prisma client..."
bun run db:generate

echo "Running migrations..."
cd backend
if bunx prisma migrate deploy; then
  echo "Migrations applied."
else
  echo "Applying initial migration..."
  bunx prisma migrate dev --name init
fi
cd "$ROOT_DIR"

echo "Seeding database..."
bun run db:seed

echo ""
echo "Development environment ready!"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:4000"
echo "  Swagger:   http://localhost:4000/api/docs"
echo "  Garage S3: http://localhost:3900"
echo "  Garage UI: http://localhost:3903 (admin API)"
echo ""
echo "Default S3 bucket: storage"
echo "Run: bun dev"
