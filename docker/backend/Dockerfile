FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
RUN bun install --frozen-lockfile --filter @storage/backend

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
