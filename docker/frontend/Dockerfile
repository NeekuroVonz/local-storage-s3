# Same flow as local — visible steps for Docker logs
FROM oven/bun:1 AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json bun.lock ./
COPY packages ./packages
COPY frontend ./frontend
COPY backend/package.json ./backend/package.json

RUN echo "==> 1/3 bun install (download + link; may take a few minutes)..." \
  && bun install --frozen-lockfile --ignore-scripts \
  && echo "==> 1/3 bun install done"

RUN echo "==> 2/3 build shared..." \
  && bun run --filter @storage/shared build \
  && echo "==> 2/3 shared done"

RUN echo "==> 3/3 build frontend (Next.js)..." \
  && mkdir -p /app/frontend/public \
  && bun run --filter @storage/frontend build \
  && echo "==> 3/3 frontend done"

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["bun", "run", "server.js"]
