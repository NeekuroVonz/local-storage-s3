# Deployment

## Production with Docker Compose

### 1. Configure Production Environment

Create a production `.env` file:

```env
JWT_SECRET=<generate-a-secure-64-char-random-string>
S3_ENDPOINT=http://garage:3900
S3_ACCESS_KEY_ID=<your-key>
S3_SECRET_ACCESS_KEY=<your-secret>
S3_REGION=garage
APP_URL=https://storage.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.storage.yourdomain.com/api/v1
```

### 2. Deploy

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Or manually:

```bash
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d
docker exec storage-backend npx prisma migrate deploy
docker exec storage-backend npx ts-node prisma/seed.ts
```

### 3. Reverse Proxy (Recommended)

Place Nginx or Traefik in front of the services:

```nginx
# Frontend
server {
    listen 443 ssl;
    server_name storage.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
    }
}

# Backend API
server {
    listen 443 ssl;
    server_name api.storage.yourdomain.com;
    location / {
        proxy_pass http://localhost:4000;
        client_max_body_size 5G;
    }
}
```

## Health Checks

| Endpoint | Purpose |
|----------|---------|
| GET /api/v1/health | Basic health |
| GET /api/v1/health/ready | Readiness (checks DB + Redis) |
| GET /api/v1/health/live | Liveness |

## Scaling

- **Backend**: Scale horizontally behind a load balancer. Ensure Redis is shared.
- **Frontend**: Stateless — scale freely.
- **PostgreSQL**: Use managed service or replication for HA.
- **Redis**: Use Redis Sentinel or managed Redis for HA.
- **Garage**: Follow Garage cluster documentation for storage scaling.

## Backup

- **PostgreSQL**: Regular pg_dump or managed backup
- **Garage**: Follow Garage backup procedures for object data
- **Redis**: Persistence optional (cache/queue only)

## Monitoring

Integrate with your monitoring stack:

- Health endpoints for uptime checks
- Structured JSON logging via Pino
- Prometheus metrics ready (extend health module)
