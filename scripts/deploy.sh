#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env not found. Copy .env.example to .env and edit it first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker is not running or you lack permission."
  echo "Try: sudo usermod -aG docker \$USER && newgrp docker"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

for var in JWT_SECRET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY GARAGE_DEFAULT_ACCESS_KEY GARAGE_DEFAULT_SECRET_KEY; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is empty in .env"
    exit 1
  fi
done

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-4000}"
export BUILDKIT_PROGRESS=plain

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

echo "==> Building images (same as local: bun install + build)"
echo "    First run can take 5–15 minutes depending on network."
compose build

echo "==> Starting stack"
compose up -d

echo "==> Waiting for backend health"
ok=0
for _ in $(seq 1 45); do
  if docker exec storage-backend wget -qO- http://localhost:4000/api/v1/health >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" -ne 1 ]]; then
  echo "Backend did not become healthy. Check: docker logs storage-backend"
  exit 1
fi

echo "==> Migrations"
docker exec -w /app/backend storage-backend bunx prisma migrate deploy

echo "==> Seed"
docker exec -w /app/backend storage-backend bunx prisma db seed

echo ""
echo "Done."
echo "  UI:      ${APP_URL:-http://localhost:${FRONTEND_PORT}}"
echo "  API:     http://localhost:${BACKEND_PORT}/api/v1"
echo "  Swagger: http://localhost:${BACKEND_PORT}/api/docs"
