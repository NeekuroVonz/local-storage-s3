FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
COPY backend/prisma ./backend/prisma

# Retry install — npm registry timeouts are common on slow networks.
# --omit=optional skips platform binaries like @esbuild/linux-x64 (only needed for Vitest).
RUN set -eux; \
  echo "==> Installing packages (retries on network failure)..."; \
  i=1; \
  until bun install --frozen-lockfile --filter @storage/backend --ignore-scripts --omit=optional; do \
    if [ "$i" -ge 5 ]; then \
      echo "==> bun install failed after 5 attempts"; \
      exit 1; \
    fi; \
    echo "==> Install attempt $i failed — retrying in 15s..."; \
    i=$((i + 1)); \
    sleep 15; \
  done; \
  echo "==> Generating Prisma client..."; \
  cd /app/backend && bunx prisma generate; \
  echo "==> Building native modules (bcrypt)..."; \
  bun --cwd /app/node_modules/bcrypt run install; \
  echo "==> Dependencies ready"

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run --filter @storage/shared build
RUN bun run --filter @storage/backend db:generate
RUN bun run --filter @storage/backend build

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --no-create-home nestjs
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/backend/prisma ./prisma
USER nestjs
EXPOSE 4000
CMD ["bun", "run", "dist/main.js"]
