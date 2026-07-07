# API Reference

Base URL: `http://localhost:4000/api/v1`

Interactive documentation: `http://localhost:4000/api/docs` (Swagger)

For integrating external apps and SDK examples, see [External Integration Guide](INTEGRATION.md).

## Authentication

All endpoints except those marked **Public** require `Authorization: Bearer <access_token>`.

### POST /auth/register
Register a new user. **Public**

### POST /auth/login
Login with email and password. **Public**

```json
{ "email": "admin@storage.local", "password": "Admin123!", "rememberMe": false }
```

### POST /auth/refresh
Refresh access token. **Public**

### POST /auth/logout
Logout current session.

### POST /auth/change-password
Change password for authenticated user.

### GET /auth/me
Get current user profile.

## Buckets

Requires `buckets:read` permission.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /buckets | buckets:read | List all buckets |
| GET | /buckets/:name | buckets:read | Get bucket details |
| POST | /buckets | buckets:write | Create bucket |
| PATCH | /buckets/:name | buckets:write | Update bucket settings |
| DELETE | /buckets/:name | buckets:delete | Delete empty bucket |

## Objects

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /buckets/:bucket/objects | objects:read | List objects |
| GET | /buckets/:bucket/objects/metadata | objects:read | Get object metadata |
| POST | /buckets/:bucket/objects/folder | objects:write | Create folder |
| POST | /buckets/:bucket/objects/rename | objects:write | Rename object |
| POST | /buckets/:bucket/objects/copy | objects:write | Copy object |
| POST | /buckets/:bucket/objects/move | objects:write | Move object |
| DELETE | /buckets/:bucket/objects | objects:delete | Delete objects |
| POST | /buckets/:bucket/objects/presigned-url | objects:read | Generate presigned URL |

## Upload

| Method | Path | Description |
|--------|------|-------------|
| POST | /buckets/:bucket/upload | Simple file upload (multipart/form-data) |
| POST | /buckets/:bucket/upload/multipart/initiate | Start multipart upload |
| POST | /buckets/:bucket/upload/multipart/:uploadId/parts | Upload a part |
| POST | /buckets/:bucket/upload/multipart/complete | Complete multipart upload |
| DELETE | /buckets/:bucket/upload/multipart/:uploadId | Abort multipart upload |

## Download

| Method | Path | Description |
|--------|------|-------------|
| GET | /buckets/:bucket/download?key= | Download single object |
| POST | /buckets/:bucket/download/zip | Download multiple objects as ZIP |

## Search

| Method | Path | Description |
|--------|------|-------------|
| GET | /search?q= | Search objects globally |
| GET | /search/saved | List saved searches |
| POST | /search/saved | Save a search |
| DELETE | /search/saved/:id | Delete saved search |

## Projects & multi-tenant access

Phase 1 tenant scoping is available. External apps should be provisioned as **projects** with dedicated buckets and members.

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | /organizations | projects:read | List organizations |
| POST | /organizations | projects:manage | Create organization |
| PATCH | /organizations/:orgId | projects:manage | Update organization |
| DELETE | /organizations/:orgId | projects:manage | Delete organization |
| GET | /projects | projects:read | List projects (scoped to membership) |
| GET | /projects/:projectId | projects:read | Get project with buckets and members |
| POST | /projects | projects:write | Create project |
| PATCH | /projects/:projectId | projects:write | Update project |
| DELETE | /projects/:projectId | projects:manage | Delete project |
| POST | /projects/:projectId/members | projects:write | Add member |
| DELETE | /projects/:projectId/members/:userId | projects:write | Remove member |
| POST | /projects/:projectId/buckets | projects:write | Create bucket and link to project |
| POST | /projects/:projectId/buckets/link | projects:write | Link existing bucket |
| DELETE | /projects/:projectId/buckets/:bucketName | projects:write | Unlink bucket |

| POST | /projects/:projectId/api-keys | projects:write | Create API key (secret returned once) |
| GET | /projects/:projectId/api-keys | projects:read | List API keys (prefix only) |
| DELETE | /projects/:projectId/api-keys/:keyId | projects:write | Revoke API key |

| GET | /projects/:projectId/grants | projects:read | List bucket access grants (`?bucketName=` optional) |
| POST | /projects/:projectId/grants | projects:write | Create bucket access grant (prefix-scoped ACL) |
| DELETE | /projects/:projectId/grants/:grantId | projects:write | Remove bucket access grant |

**API key authentication:** Pass `Authorization: Bearer sk_live_...` or `sk_test_...` on storage endpoints. Keys are scoped to their project buckets and granted permissions only.

**Bucket access grants:** Restrict users or API keys to specific folder prefixes within project buckets. Grants can also grant bucket access without project membership.

| GET | /projects/:projectId/s3-credentials | projects:read | S3 credential status (no secret) |
| POST | /projects/:projectId/s3-credentials/provision | projects:manage | Provision per-tenant Garage S3 key (secret once) |
| POST | /projects/:projectId/s3-credentials/rotate | projects:manage | Rotate S3 key (new secret once) |
| DELETE | /projects/:projectId/s3-credentials | projects:manage | Revoke S3 credentials |

**Presigned URLs:** `POST /buckets/:bucket/objects/presigned-url` returns URLs rewritten to `S3_PUBLIC_ENDPOINT` when set.

| GET | /projects/:projectId/webhooks | projects:read | List webhooks |
| POST | /projects/:projectId/webhooks | projects:write | Create webhook (signing secret once) |
| DELETE | /projects/:projectId/webhooks/:webhookId | projects:write | Remove webhook |
| GET | /projects/:projectId/webhooks/:webhookId/deliveries | projects:read | List delivery attempts |

| GET | /projects/:projectId/quotas | projects:read | Quota limits and usage |
| PATCH | /projects/:projectId/quotas | projects:manage | Update quota limits |
| POST | /projects/:projectId/quotas/reconcile | projects:manage | Reconcile usage from S3 |

## Sharing

| Method | Path | Description |
|--------|------|-------------|
| POST | /shares | Create share link |
| GET | /shares | List user shares |
| DELETE | /shares/:id | Revoke share |
| POST | /shares/:token/access | Access shared object (**Public**) |

## Dashboard & Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | /dashboard/stats | Dashboard statistics |
| GET | /dashboard/activity | Recent activity |
| GET | /analytics | Storage analytics |

## Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/health | System health check |
| GET | /admin/stats | System statistics |

## Health (Public)

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Basic health check |
| GET | /health/ready | Readiness probe |
| GET | /health/live | Liveness probe |

## Error Format

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": { "email": ["Invalid email"] },
  "timestamp": "2026-07-07T04:00:00.000Z",
  "path": "/api/v1/auth/login"
}
```
