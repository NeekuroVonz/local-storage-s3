#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Building production images..."
docker compose -f docker/docker-compose.yml build

echo "Starting production stack..."
docker compose -f docker/docker-compose.yml up -d

echo "Running database migrations..."
docker exec storage-backend bunx prisma migrate deploy

echo "Seeding database..."
docker exec storage-backend bunx prisma db seed

echo ""
echo "Production deployment complete!"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:4000"
