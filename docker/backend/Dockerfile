# Same flow as local: copy repo → bun install → build
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY packages ./packages
COPY backend ./backend
COPY frontend/package.json ./frontend/package.json

RUN bun install --frozen-lockfile
RUN bun run --filter @storage/shared build
RUN bun run --filter @storage/backend db:generate
RUN bun run --filter @storage/backend build

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --no-create-home nestjs

COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/bun.lock ./bun.lock
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nestjs:nodejs /app/backend ./backend

USER nestjs
WORKDIR /app/backend
EXPOSE 4000
CMD ["bun", "run", "dist/main.js"]
