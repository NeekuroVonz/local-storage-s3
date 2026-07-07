#!/usr/bin/env bash
# Apply local Docker Garage S3 defaults to root .env when credentials are missing or placeholders.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

DEFAULT_ACCESS_KEY="GK0011223344556677"
DEFAULT_SECRET_KEY="dev-storage-secret-key-change-in-production"
DEFAULT_ENDPOINT="http://localhost:3900"
DEFAULT_BUCKET="storage"

needs_update=false

if [ ! -f "$ENV_FILE" ]; then
  needs_update=true
elif grep -qE '^S3_ACCESS_KEY_ID=(GK\.\.\.|your-garage|GKdevstoragekey001|)$' "$ENV_FILE" 2>/dev/null; then
  needs_update=true
elif grep -qE '^S3_SECRET_ACCESS_KEY=(\.\.\.|your-garage|)$' "$ENV_FILE" 2>/dev/null; then
  needs_update=true
fi

if [ "$needs_update" = true ]; then
  if [ ! -f "$ENV_FILE" ]; then
    cp "$ROOT_DIR/.env.example" "$ENV_FILE"
  fi

  set_kv() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$ENV_FILE"; then
      if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
      else
        sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
      fi
    else
      echo "${key}=${value}" >> "$ENV_FILE"
    fi
  }

  set_kv "S3_ENDPOINT" "$DEFAULT_ENDPOINT"
  set_kv "S3_REGION" "garage"
  set_kv "S3_ACCESS_KEY_ID" "$DEFAULT_ACCESS_KEY"
  set_kv "S3_SECRET_ACCESS_KEY" "$DEFAULT_SECRET_KEY"
  set_kv "S3_FORCE_PATH_STYLE" "true"
  set_kv "S3_PUBLIC_ENDPOINT" "$DEFAULT_ENDPOINT"
  set_kv "GARAGE_ADMIN_ENDPOINT" "http://localhost:3903"
  set_kv "GARAGE_ADMIN_TOKEN" "dev-garage-admin-token-not-for-production"
  set_kv "GARAGE_DEFAULT_BUCKET" "$DEFAULT_BUCKET"
  set_kv "GARAGE_DEFAULT_ACCESS_KEY" "$DEFAULT_ACCESS_KEY"
  set_kv "GARAGE_DEFAULT_SECRET_KEY" "$DEFAULT_SECRET_KEY"

  echo "Configured .env with Docker Garage development S3 credentials."
fi

if [ -f "$ENV_FILE" ]; then
  set_kv_if_missing() {
    local key="$1"
    local value="$2"
    if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
      echo "${key}=${value}" >> "$ENV_FILE"
      echo "Added missing ${key} to .env"
    fi
  }

  set_kv_if_missing "S3_PUBLIC_ENDPOINT" "$DEFAULT_ENDPOINT"
  set_kv_if_missing "GARAGE_ADMIN_ENDPOINT" "http://localhost:3903"
  set_kv_if_missing "GARAGE_ADMIN_TOKEN" "dev-garage-admin-token-not-for-production"
fi
