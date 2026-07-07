#!/usr/bin/env bash
# Sync root .env into backend/.env so Prisma CLI and NestJS find DATABASE_URL.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -f "$ROOT_DIR/.env" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "Created .env from .env.example — review values before production use."
fi

cp "$ROOT_DIR/.env" "$ROOT_DIR/backend/.env"

# Export DATABASE_URL for shell commands without sourcing the whole .env file.
if grep -q '^DATABASE_URL=' "$ROOT_DIR/.env"; then
  DATABASE_URL="$(grep '^DATABASE_URL=' "$ROOT_DIR/.env" | cut -d= -f2- | tr -d '"')"
  export DATABASE_URL
else
  export DATABASE_URL="postgresql://storage:storage@localhost:5432/storage_platform?schema=public"
fi
