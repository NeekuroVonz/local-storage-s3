# Same flow as local — but with visible steps (Docker hides bun link/postinstall progress)
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY packages ./packages
COPY backend ./backend
COPY frontend/package.json ./frontend/package.json

# --ignore-scripts: install only (no silent prisma postinstall).
# Prisma + bcrypt run as separate steps so logs show progress.
RUN echo "==> 1/4 bun install (download + link; may take a few minutes)..." \
  && bun install --frozen-lockfile --ignore-scripts \
  && echo "==> 1/4 bun install done"

RUN echo "==> 2/4 prisma generate..." \
  && bun run --filter @storage/backend db:generate \
  && echo "==> 2/4 prisma generate done"

RUN echo "==> 3/4 bcrypt native bindings..." \
  && BCRYPT_DIR="$(find /app/node_modules -type d -name bcrypt 2>/dev/null | head -1)" \
  && if [ -n "$BCRYPT_DIR" ] && [ -f "$BCRYPT_DIR/package.json" ]; then \
       bun --cwd "$BCRYPT_DIR" run install; \
     else \
       echo "bcrypt package not found under node_modules (ok if unused)"; \
     fi \
  && echo "==> 3/4 bcrypt done"

RUN echo "==> 4/4 build shared + backend..." \
  && bun run --filter @storage/shared build \
  && bun run --filter @storage/backend build \
  && echo "==> 4/4 build done"

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
