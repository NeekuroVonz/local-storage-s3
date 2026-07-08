import { DocumentBuilder } from '@nestjs/swagger';

const API_DESCRIPTION = `
Production-grade **S3-compatible Storage Management Platform** REST API.

Compatible with Garage, AWS S3, MinIO, and Cloudflare R2 backends.

## Base URL

\`\`\`
http://localhost:4000/api/v1
\`\`\`

## Authentication

| Method | Header | Use case |
|--------|--------|----------|
| **JWT** | \`Authorization: Bearer <accessToken>\` | Web UI, admin operations, user sessions |
| **API key** | \`Authorization: Bearer sk_live_...\` | External apps scoped to a project |

Obtain JWT tokens via \`POST /auth/login\`. Create project API keys via \`POST /projects/:projectId/api-keys\`.

## Response envelope

Most endpoints return:

\`\`\`json
{
  "success": true,
  "data": { }
}
\`\`\`

Errors return:

\`\`\`json
{
  "statusCode": 400,
  "message": "Human-readable error",
  "error": "Bad Request"
}
\`\`\`

## Multi-tenant model

- **Organization** → groups projects
- **Project** → isolated tenant with linked buckets, API keys, webhooks, quotas
- **Project buckets** → storage isolated per tenant; members/API keys only see linked buckets

## Permissions

RBAC permissions are enforced per endpoint (e.g. \`buckets:read\`, \`projects:write\`). Admin users have full access.
`.trim();

export function buildSwaggerDocument() {
  return new DocumentBuilder()
    .setTitle('Storage Platform API')
    .setDescription(API_DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token from POST /auth/login, or project API key (sk_live_... / sk_test_...)',
      },
      'bearer',
    )
    .addTag('Auth', 'User registration, login, sessions, and password management')
    .addTag('Buckets', 'S3 bucket lifecycle — list, create, update, delete')
    .addTag('Objects', 'Object operations inside buckets — list, copy, move, delete, presigned URLs')
    .addTag('Upload', 'File upload — simple and multipart')
    .addTag('Download', 'Download objects or ZIP archives')
    .addTag('Files', 'File registry — FileId upload/download/metadata/search/soft-delete')
    .addTag('Folders', 'Folder management — roots, binding, search, in-use guards')
    .addTag('Organizations', 'Top-level grouping for multi-tenant projects')
    .addTag('Projects', 'Tenants — projects, members, buckets, API keys, grants, S3 credentials, webhooks, quotas')
    .addTag('Search', 'Cross-bucket object search and saved queries')
    .addTag('Share', 'Public share links for objects')
    .addTag('Users', 'Platform user administration')
    .addTag('Roles', 'RBAC roles and permissions')
    .addTag('Dashboard', 'Dashboard metrics and recent activity widgets')
    .addTag('Activity', 'Audit log — list and export')
    .addTag('Analytics', 'Storage usage analytics')
    .addTag('Settings', 'System configuration key-value store')
    .addTag('Admin', 'System health and statistics (admin only)')
    .addTag('Health', 'Kubernetes-style health probes (public)')
    .addTag('Notifications', 'In-app user notifications')
    .build();
}
