# External Integration Guide

How external applications (Next.js, NestJS, Java Spring Boot, .NET, Python, mobile, etc.) upload, download, and manage files in **their own buckets** on this Storage Platform.

## Architecture

```
┌─────────────────┐     JWT / API key (future)     ┌──────────────────┐
│  External App   │ ──────────────────────────────▶ │  Storage API     │
│  (any stack)    │         REST /api/v1            │  (NestJS)        │
└─────────────────┘                                 └────────┬─────────┘
                                                               │ S3 API
                                                               ▼
                                                      ┌──────────────────┐
                                                      │  Garage / MinIO  │
                                                      │  / R2 / AWS S3   │
                                                      └──────────────────┘
```

**Default integration path:** call the REST API with a platform user token. The API proxies all storage operations and enforces RBAC, audit logs, search, and sharing.

| Approach | Best for | Auth today |
|----------|----------|------------|
| **REST API** | Backends, full platform features | JWT (`POST /auth/login`) |
| **Presigned URLs** | Browser/mobile direct upload/download | JWT to mint URL, then direct S3 PUT/GET |
| **Direct S3 SDK** | High-throughput internal services | Per-project Garage key (manual, bypasses platform) |

See also: [API Reference](API.md), [Upload Flow](UploadFlow.md), [Sharing Flow](SharingFlow.md), [Permission System](PermissionSystem.md).

---

## Quick start (REST API)

### 1. Provision a project

For each external project:

1. Create a **platform user** (admin UI or `POST /auth/register` if enabled).
2. Assign a role with the permissions they need (`operator` is typical for upload/download).
3. Create a **dedicated bucket**: `POST /buckets` with `{ "name": "acme-prod-files" }`.
4. Store credentials in the project's environment (never in frontend code).

```env
STORAGE_API_URL=https://storage.example.com/api/v1
STORAGE_EMAIL=acme-service@example.com
STORAGE_PASSWORD=<strong-password>
STORAGE_BUCKET=acme-prod-files
```

### 2. Authenticate

```http
POST /auth/login
Content-Type: application/json

{
  "email": "acme-service@example.com",
  "password": "your-password",
  "rememberMe": true
}
```

Response (abbreviated):

```json
{
  "tokens": {
    "accessToken": "eyJhbG...",
    "refreshToken": "a7026bd1-...",
    "expiresIn": 900
  }
}
```

Use `Authorization: Bearer <accessToken>` on all subsequent requests. Refresh before expiry:

```http
POST /auth/refresh
Content-Type: application/json

{ "refreshToken": "<refreshToken>" }
```

### 3. Core operations

| Action | Request |
|--------|---------|
| List objects | `GET /buckets/{bucket}/objects?prefix=uploads/&delimiter=/` |
| Upload file | `POST /buckets/{bucket}/upload?key=uploads/photo.jpg` (multipart field `file`) |
| Download file | `GET /buckets/{bucket}/download?key=uploads/photo.jpg` |
| Delete files | `DELETE /buckets/{bucket}/objects` body `{ "keys": ["uploads/photo.jpg"] }` |
| Search | `GET /search?q=invoice&bucket={bucket}` |
| Presigned URL | `POST /buckets/{bucket}/objects/presigned-url` body `{ "key": "...", "operation": "getObject", "expiresIn": 3600 }` |

Interactive docs: `GET /api/docs` (Swagger).

---

## Integration patterns

### Pattern A — REST API proxy (recommended)

All traffic goes through your platform. Works from any HTTP client.

**Pros:** RBAC, audit trail, search, shares, no S3 credentials in client apps.  
**Cons:** Files pass through the API (use multipart for large files or presigned URLs).

```
App Backend ──login──▶ POST /auth/login
            ──upload─▶ POST /buckets/:bucket/upload?key=path/file.pdf
            ──list────▶ GET  /buckets/:bucket/objects?prefix=path/
            ──download▶ GET  /buckets/:bucket/download?key=path/file.pdf
```

### Pattern B — Presigned URLs

Backend mints a short-lived URL; client uploads/downloads directly to S3.

```
App Backend ──▶ POST /buckets/:bucket/objects/presigned-url
              ◀── { "url": "https://s3.example.com/...", "expiresAt": "..." }

Browser/App ──▶ PUT or GET <presigned-url>
```

**Operations:** `getObject` (download), `putObject` (upload).  
**Expiry:** 60 seconds – 7 days (`expiresIn` in seconds).

**Production note:** Presigned URLs are signed against `S3_ENDPOINT`. Expose a **public S3 URL** (reverse proxy) and add `S3_PUBLIC_ENDPOINT` (planned) so clients outside Docker can reach the URL.

### Pattern C — Direct S3 SDK

Bypass the platform; use AWS SDK / MinIO client against Garage directly.

```env
S3_ENDPOINT=https://s3.example.com
S3_ACCESS_KEY_ID=GK...
S3_SECRET_ACCESS_KEY=...
S3_REGION=garage
S3_FORCE_PATH_STYLE=true
```

**Pros:** Maximum throughput, standard S3 tooling.  
**Cons:** No platform RBAC/audit/UI. Requires manual per-project key provisioning in Garage (`garage key create`, `garage bucket allow`).

---

## Language examples

### TypeScript / NestJS

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class StorageClient implements OnModuleInit {
  private accessToken = '';
  private refreshToken = '';

  private get baseUrl() {
    return process.env.STORAGE_API_URL!;
  }

  async onModuleInit() {
    await this.login();
  }

  async login() {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.STORAGE_EMAIL,
        password: process.env.STORAGE_PASSWORD,
        rememberMe: true,
      }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = await res.json();
    this.accessToken = data.tokens.accessToken;
    this.refreshToken = data.tokens.refreshToken;
  }

  private async request(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(init.headers as Record<string, string>),
      },
    });
    if (res.status === 401) {
      await this.refresh();
      return this.request(path, init);
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? `Request failed: ${res.status}`);
    }
    return res;
  }

  private async refresh() {
    const res = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });
    const data = await res.json();
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
  }

  async upload(key: string, buffer: Buffer, filename: string, contentType?: string) {
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: contentType }), filename);
    const res = await this.request(
      `/buckets/${process.env.STORAGE_BUCKET}/upload?key=${encodeURIComponent(key)}`,
      { method: 'POST', body: form },
    );
    return res.json();
  }

  async download(key: string): Promise<Buffer> {
    const res = await this.request(
      `/buckets/${process.env.STORAGE_BUCKET}/download?key=${encodeURIComponent(key)}`,
    );
    return Buffer.from(await res.arrayBuffer());
  }

  async list(prefix = '') {
    const params = new URLSearchParams({ prefix, delimiter: '/' });
    const res = await this.request(
      `/buckets/${process.env.STORAGE_BUCKET}/objects?${params}`,
    );
    const json = await res.json();
    return json.data;
  }

  async delete(keys: string[]) {
    const res = await this.request(
      `/buckets/${process.env.STORAGE_BUCKET}/objects`,
      { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys }) },
    );
    return res.json();
  }
}
```

### Next.js (App Router — server-side)

Keep credentials on the server only (Route Handler or Server Action).

```typescript
// app/api/files/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API = process.env.STORAGE_API_URL!;
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.STORAGE_EMAIL,
      password: process.env.STORAGE_PASSWORD,
    }),
  });
  const { tokens } = await res.json();
  cachedToken = { value: tokens.accessToken, expiresAt: Date.now() + tokens.expiresIn * 1000 - 30_000 };
  return cachedToken.value;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file') as File;
  const key = (form.get('key') as string) ?? file.name;
  const token = await getToken();

  const uploadForm = new FormData();
  uploadForm.append('file', file);

  const res = await fetch(
    `${API}/buckets/${process.env.STORAGE_BUCKET}/upload?key=${encodeURIComponent(key)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: uploadForm },
  );

  if (!res.ok) return NextResponse.json(await res.json(), { status: res.status });
  return NextResponse.json(await res.json());
}
```

For **browser direct upload**, mint a presigned URL on the server and `PUT` from the client:

```typescript
// Server: POST /buckets/:bucket/objects/presigned-url
// { "key": "uploads/photo.jpg", "operation": "putObject", "expiresIn": 3600 }

// Client:
await fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
```

### Java — Spring Boot

```java
@Service
public class StorageClient {
  @Value("${storage.api-url}") private String apiUrl;
  @Value("${storage.email}") private String email;
  @Value("${storage.password}") private String password;
  @Value("${storage.bucket}") private String bucket;

  private final WebClient client = WebClient.builder().build();
  private String accessToken;

  @PostConstruct
  public void login() {
    var body = Map.of("email", email, "password", password, "rememberMe", true);
    var response = client.post().uri(apiUrl + "/auth/login")
      .contentType(MediaType.APPLICATION_JSON).bodyValue(body).retrieve()
      .bodyToMono(JsonNode.class).block();
    accessToken = response.path("tokens").path("accessToken").asText();
  }

  public void upload(String key, Resource file) {
    var multipart = new LinkedMultiValueMap<String, Object>();
    multipart.add("file", file);
    client.post()
      .uri(apiUrl + "/buckets/{bucket}/upload?key={key}", bucket, key)
      .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
      .contentType(MediaType.MULTIPART_FORM_DATA)
      .body(BodyInserters.fromMultipartData(multipart))
      .retrieve().toBodilessEntity().block();
  }

  public byte[] download(String key) {
    return client.get()
      .uri(apiUrl + "/buckets/{bucket}/download?key={key}", bucket, key)
      .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
      .retrieve().bodyToMono(byte[].class).block();
  }
}
```

Direct S3 alternative: add `software.amazon.awssdk:s3` and point at `S3_ENDPOINT` with project-specific Garage keys (Pattern C).

### C# — .NET

```csharp
public sealed class StorageClient
{
    private readonly HttpClient _http = new();
    private readonly string _apiUrl = Environment.GetEnvironmentVariable("STORAGE_API_URL")!;
    private readonly string _bucket = Environment.GetEnvironmentVariable("STORAGE_BUCKET")!;
    private string _accessToken = "";

    public async Task LoginAsync()
    {
        var payload = JsonSerializer.Serialize(new
        {
            email = Environment.GetEnvironmentVariable("STORAGE_EMAIL"),
            password = Environment.GetEnvironmentVariable("STORAGE_PASSWORD"),
            rememberMe = true
        });
        var res = await _http.PostAsync($"{_apiUrl}/auth/login",
            new StringContent(payload, Encoding.UTF8, "application/json"));
        res.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
        _accessToken = doc.RootElement.GetProperty("tokens").GetProperty("accessToken").GetString()!;
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
    }

    public async Task UploadAsync(string key, Stream fileStream, string fileName)
    {
        using var form = new MultipartFormDataContent();
        form.Add(new StreamContent(fileStream), "file", fileName);
        var res = await _http.PostAsync(
            $"{_apiUrl}/buckets/{_bucket}/upload?key={Uri.EscapeDataString(key)}", form);
        res.EnsureSuccessStatusCode();
    }

    public async Task<Stream> DownloadAsync(string key)
    {
        var res = await _http.GetAsync(
            $"{_apiUrl}/buckets/{_bucket}/download?key={Uri.EscapeDataString(key)}");
        res.EnsureSuccessStatusCode();
        return await res.Content.ReadAsStreamAsync();
    }
}
```

### Python

```python
import os
import requests

API = os.environ["STORAGE_API_URL"]
BUCKET = os.environ["STORAGE_BUCKET"]

class StorageClient:
    def __init__(self):
        self.session = requests.Session()
        self._login()

    def _login(self):
        r = self.session.post(f"{API}/auth/login", json={
            "email": os.environ["STORAGE_EMAIL"],
            "password": os.environ["STORAGE_PASSWORD"],
            "rememberMe": True,
        })
        r.raise_for_status()
        token = r.json()["tokens"]["accessToken"]
        self.session.headers["Authorization"] = f"Bearer {token}"

    def upload(self, key: str, path: str):
        with open(path, "rb") as f:
            r = self.session.post(
                f"{API}/buckets/{BUCKET}/upload",
                params={"key": key},
                files={"file": f},
            )
        r.raise_for_status()
        return r.json()

    def download(self, key: str, dest: str):
        r = self.session.get(f"{API}/buckets/{BUCKET}/download", params={"key": key})
        r.raise_for_status()
        with open(dest, "wb") as f:
            f.write(r.content)

    def list_objects(self, prefix: str = ""):
        r = self.session.get(
            f"{API}/buckets/{BUCKET}/objects",
            params={"prefix": prefix, "delimiter": "/"},
        )
        r.raise_for_status()
        return r.json()["data"]
```

---

## Large files (multipart upload)

For files **≥ 5 MB**, use the multipart API:

```
1. POST /buckets/:bucket/upload/multipart/initiate
   { "key": "large/video.mp4", "contentType": "video/mp4" }
   → { "uploadId": "..." }

2. POST /buckets/:bucket/upload/multipart/:uploadId/parts  (repeat per chunk)
   multipart field: file (chunk)
   → { "partNumber": 1, "etag": "..." }

3. POST /buckets/:bucket/upload/multipart/complete
   { "uploadId": "...", "parts": [{ "partNumber": 1, "etag": "..." }, ...] }
```

See [Upload Flow](UploadFlow.md) for the full sequence.

---

## Error handling

All API errors follow a consistent shape:

```json
{
  "success": false,
  "statusCode": 403,
  "message": "Insufficient permissions",
  "timestamp": "2026-07-07T07:00:00.000Z",
  "path": "/api/v1/buckets/other-project/files"
}
```

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Token expired or missing | Refresh token or re-login |
| 403 | Insufficient permissions | Check user role / bucket access |
| 404 | Bucket or object not found | Verify bucket name and object key |
| 409 | Bucket already exists / not empty | Use a different name or empty bucket first |
| 503 | Storage backend unreachable | Check Garage/MinIO and `S3_*` env vars |

---

## Security checklist

- **Never** put platform passwords or S3 secret keys in frontend bundles or mobile apps.
- Use a **dedicated service user** per external project, not shared admin accounts.
- Prefer **server-side** upload/download or **presigned URLs** with short expiry for clients.
- Scope object keys with a project prefix: `acme/uploads/...` to simplify lifecycle and search.
- Rotate passwords / API keys (when available) on a schedule.
- Enable HTTPS in production for both API and S3 endpoints.
- Configure CORS: today `APP_URL` controls API CORS; add client origins for multi-app deployments.

---

## Per-project isolation (today vs planned)

### Today — project-scoped isolation (Phase 1)

| What works | Details |
|------------|---------|
| Organizations & projects | `POST /organizations`, `POST /projects` |
| Project buckets | `POST /projects/:id/buckets` creates and links a bucket |
| Member access | `POST /projects/:id/members` — members only see project buckets |
| Bucket list filtering | `GET /buckets` returns only accessible buckets |
| Object/upload/download guard | Blocked if bucket not in user's project(s) |
| Legacy mode | Users with **no** project memberships still see all buckets |

**Provision an external app:**

```http
POST /organizations
{ "name": "acme", "displayName": "Acme Corp" }

POST /projects
{ "organizationId": "...", "name": "Production", "slug": "acme-production" }

POST /projects/:projectId/buckets
{ "name": "acme-prod-files", "isDefault": true }

POST /projects/:projectId/members
{ "userId": "<service-user-uuid>", "role": "MEMBER" }
```

The service user then only sees `acme-prod-files` when calling the storage API.

### API keys (Phase 2 — implemented)

External apps authenticate with:

```http
Authorization: Bearer sk_live_<secret>
```

**Create a key:**

```http
POST /projects/:projectId/api-keys
{
  "name": "nextjs-backend",
  "permissions": ["objects:read", "objects:write", "buckets:read"],
  "bucketNames": [],
  "environment": "live",
  "expiresInDays": 90
}
```

The full secret is returned **once** in the response. Store it securely.

**Allowed permissions on API keys:**
`buckets:read`, `objects:read`, `objects:write`, `objects:delete`, `shares:read`, `shares:write`

**Scope:**
- Keys only access buckets linked to their project
- Optional `bucketNames` restricts to a subset of project buckets
- Keys cannot access user management, project admin, or `/auth/me`

### Bucket access grants (Phase 3 — implemented)

Per-bucket ACL grants with optional **folder prefix** scope for users and API keys.

**Create a grant:**

```http
POST /projects/:projectId/grants
{
  "bucketName": "acme-prod-files",
  "subjectType": "USER",
  "subjectId": "<user-uuid>",
  "permissions": ["objects:read", "objects:write", "buckets:read"],
  "prefix": "uploads/"
}
```

**Subject types:** `USER`, `API_KEY`

**Behavior:**
- Grants can give bucket access without project membership (grant-only access)
- When grants exist for a subject on a bucket, object operations are restricted to matching prefixes
- Empty `prefix` means full bucket access for that grant
- Multiple grants per subject/bucket are allowed (different prefixes)

**Endpoints:**
- `GET /projects/:projectId/grants` — list grants (optional `?bucketName=`)
- `POST /projects/:projectId/grants` — create grant
- `DELETE /projects/:projectId/grants/:grantId` — remove grant

### Per-tenant S3 credentials (Phase 4 — implemented)

Projects can receive dedicated Garage S3 keys for **direct SDK access** (higher throughput, bypasses platform REST API).

**Provision credentials:**

```http
POST /projects/:projectId/s3-credentials/provision
```

Returns `accessKeyId`, `secretAccessKey`, `endpoint`, `region`, and `forcePathStyle` **once**. The secret is encrypted at rest.

**Other endpoints:**
- `GET /projects/:projectId/s3-credentials` — status (no secret)
- `POST /projects/:projectId/s3-credentials/rotate` — new key, revokes old bucket permissions
- `DELETE /projects/:projectId/s3-credentials` — revoke and clear stored credentials

**Auto-sync:** When a bucket is linked/unlinked, the project key permissions are updated via the Garage Admin API.

**Presigned URLs:** Set `S3_PUBLIC_ENDPOINT` to a browser-reachable S3 URL. Presigned URLs are rewritten from `S3_ENDPOINT` to `S3_PUBLIC_ENDPOINT` so external clients outside Docker can use them.

**Required env vars:**
```env
GARAGE_ADMIN_ENDPOINT=http://localhost:3903
GARAGE_ADMIN_TOKEN=<from garage.toml [admin] section>
S3_PUBLIC_ENDPOINT=http://localhost:3900
CREDENTIALS_ENCRYPTION_KEY=<optional; falls back to JWT_SECRET hash>
```

### Webhooks and quotas (Phase 5 — implemented)

**Webhooks** notify external systems when objects are created or deleted in project buckets.

```http
POST /projects/:projectId/webhooks
{
  "name": "prod-events",
  "url": "https://api.example.com/hooks/storage",
  "events": ["object.created", "object.deleted"]
}
```

The signing secret is returned **once**. Verify deliveries with HMAC-SHA256:

```
X-Webhook-Signature: sha256=<hex>
X-Webhook-Timestamp: <iso>
X-Webhook-Event: object.created
```

Payload envelope:
```json
{
  "id": "evt-uuid",
  "type": "object.created",
  "createdAt": "2026-07-07T12:00:00.000Z",
  "projectId": "...",
  "data": { "bucket": "acme-files", "key": "uploads/a.jpg", "size": 12345, "contentType": "image/jpeg" }
}
```

Deliveries are queued via BullMQ with retries (5 attempts, exponential backoff).

**Quotas** limit storage per project:

```http
PATCH /projects/:projectId/quotas
{ "maxStorageBytes": "10737418240", "maxObjectCount": 100000 }
```

- `GET /projects/:projectId/quotas` — limits + current usage
- `POST /projects/:projectId/quotas/reconcile` — recalculate usage from S3 bucket stats

Uploads to project-linked buckets are blocked when quotas would be exceeded.

### Multi-tenant integration complete

All five phases of [INTEGRATION.md](INTEGRATION.md) are implemented.

| Phase | Deliverable |
|-------|-------------|
| **Phase 1** | `Project` + `ProjectBucket`; filter bucket list by project membership |
| **Phase 2** | `ApiKey` auth guard; `POST /projects/:id/api-keys` |
| **Phase 3** | `BucketAccessGrant` for prefix-level ACLs |
| **Phase 4** | Auto Garage key provisioning; `S3_PUBLIC_ENDPOINT` for presigned URLs |
| **Phase 5** | Webhooks (`object.created`, `object.deleted`) + quotas per project |

All phases above are **implemented**.

---

## CORS and multiple client origins

The API CORS origin defaults to `APP_URL` (the platform UI). External web apps on other domains must either:

1. **Proxy** storage calls through their own backend (recommended), or
2. Add their origin to an extended CORS allowlist (config change / future `CORS_ORIGINS` env var).

Presigned URL uploads additionally require CORS on the **S3 endpoint** (Garage/MinIO bucket CORS via `PATCH /buckets/:name`).

---

## Related documentation

- [API Reference](API.md) — full endpoint list
- [Environment Variables](EnvironmentVariables.md) — `S3_*`, `JWT_*`, `APP_URL`
- [Installation](Installation.md) — Garage setup and dev credentials
- [Deployment](Deployment.md) — production configuration
- [Permission System](PermissionSystem.md) — roles and permissions matrix

---

## Summary

| Need | Use now |
|------|---------|
| Backend uploads/downloads | REST API + JWT or `sk_live_...` API key |
| Browser uploads | Server proxy or presigned URL (`S3_PUBLIC_ENDPOINT`) |
| Strict bucket isolation | `ProjectBucket` + `BucketAccessGrant` |
| Max throughput | Per-project S3 credentials via `POST .../s3-credentials/provision` |
| Event notifications | Project webhooks (`object.created`, `object.deleted`) |
| Storage limits | Per-project quotas on linked buckets |

Multi-tenant integration is complete. See [ROADMAP](ROADMAP.md) for future platform features.
