#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="$ROOT_DIR/.env"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Error: $name is not set in .env"
    exit 1
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env not found at $ENV_FILE"
  echo "Copy .env.example to .env and configure it first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon is not running or you lack permission."
  echo "Try: sudo usermod -aG docker \$USER  (then log out and back in)"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

for var in JWT_SECRET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY GARAGE_DEFAULT_ACCESS_KEY GARAGE_DEFAULT_SECRET_KEY; do
  require_env "$var"
done

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-4000}"

# Plain build logs where supported; avoid compose bake hangs on some installs.
export BUILDKIT_PROGRESS=plain
if docker compose build --help 2>&1 | grep -q 'COMPOSE_BAKE'; then
  export COMPOSE_BAKE=false
fi

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

echo "Docker: $(docker compose version)"
echo "Building production images (this may take several minutes on first run)..."
compose build

echo "Starting production stack..."
compose up -d

echo "Waiting for backend..."
for _ in $(seq 1 30); do
  if docker exec storage-backend wget -qO- http://localhost:4000/api/v1/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Running database migrations..."
docker exec storage-backend bunx prisma migrate deploy

echo "Seeding database..."
docker exec storage-backend bunx prisma db seed

echo ""
echo "Production deployment complete!"
echo "  Frontend: ${APP_URL:-http://localhost:${FRONTEND_PORT}}"
echo "  Backend:  http://localhost:${BACKEND_PORT}"
echo "  API docs: http://localhost:${BACKEND_PORT}/api/docs"
