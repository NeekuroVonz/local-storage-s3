# Environment Variables

## Application

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| NODE_ENV | No | development | Environment mode |
| APP_NAME | No | Storage Platform | Application display name |
| APP_URL | No | http://localhost:3000 | Frontend URL (for CORS, share links) |
| BACKEND_PORT | No | 4000 | Backend server port |

## Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| JWT_SECRET | **Yes** | — | JWT signing secret (min 32 chars) |
| JWT_ACCESS_EXPIRES_IN | No | 15m | Access token lifetime |
| JWT_REFRESH_EXPIRES_IN | No | 7d | Refresh token lifetime |
| JWT_REFRESH_EXPIRES_IN_REMEMBER | No | 30d | Refresh token with "Remember Me" |
| BCRYPT_ROUNDS | No | 12 | Password hashing rounds |

## Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | **Yes** | — | PostgreSQL connection string |

## Redis

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| REDIS_HOST | No | localhost | Redis hostname |
| REDIS_PORT | No | 6379 | Redis port |
| REDIS_PASSWORD | No | — | Redis password |

## S3 / Garage

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| S3_ENDPOINT | **Yes** | — | Garage S3 endpoint URL |
| S3_REGION | No | garage | S3 region identifier |
| S3_ACCESS_KEY_ID | **Yes** | — | S3 access key |
| S3_SECRET_ACCESS_KEY | **Yes** | — | S3 secret key |
| S3_FORCE_PATH_STYLE | No | true | Use path-style URLs (required for Garage) |
| S3_PUBLIC_ENDPOINT | No | S3_ENDPOINT | Public S3 URL for presigned URLs (browser/external clients) |
| GARAGE_ADMIN_ENDPOINT | No | http://localhost:3903 | Garage Admin API URL |
| GARAGE_ADMIN_TOKEN | No* | — | Garage admin bearer token (`[admin]` in garage.toml) |
| CREDENTIALS_ENCRYPTION_KEY | No | JWT_SECRET (hashed) | AES key source for encrypted tenant S3 secrets |

\* Required for `POST /projects/:id/s3-credentials/provision`

## File registry (`/files`, `/folders`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| FILE_SOFT_DELETE_ENABLED | No | true | Soft-delete on `DELETE /files` unless `hard=true` |
| UPLOAD_MAX_BYTES | No | 104857600 | Max upload size (100MB) |
| UPLOAD_ALLOWED_EXTENSIONS | No | _(empty = all)_ | e.g. `pdf,png,jpg` |
| UPLOAD_ALLOWED_MIME_TYPES | No | _(empty = all)_ | e.g. `image/*,application/pdf` |
| FILE_DEFAULT_BUCKET | No | — | Default bucket when upload omits `bucket` |

## SMTP (Optional)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| SMTP_HOST | No | — | SMTP server hostname |
| SMTP_PORT | No | 587 | SMTP port |
| SMTP_USER | No | — | SMTP username |
| SMTP_PASSWORD | No | — | SMTP password |
| SMTP_FROM | No | noreply@storage.local | From email address |

## Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| NEXT_PUBLIC_API_URL | No | http://localhost:4000/api/v1 | Backend API URL |

## Example .env

```env
NODE_ENV=development
APP_URL=http://localhost:3000
BACKEND_PORT=4000
JWT_SECRET=your-super-secure-jwt-secret-key-min-32-chars
DATABASE_URL=postgresql://storage:storage@localhost:5432/storage_platform?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
S3_ENDPOINT=http://localhost:3900
S3_REGION=garage
S3_ACCESS_KEY_ID=GKyour-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_FORCE_PATH_STYLE=true
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```
