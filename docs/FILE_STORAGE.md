# File Storage (FileId registry)

Layer on top of S3 that provides **FileId**, metadata, soft delete, and folders.

Bytes still live in Garage/S3. Metadata lives in Postgres (`stored_files`, `storage_folders`).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `FILE_SOFT_DELETE_ENABLED` | `true` | Soft-delete on `DELETE /files` unless `hard=true` |
| `UPLOAD_MAX_BYTES` | `104857600` (100MB) | Max upload size |
| `UPLOAD_ALLOWED_EXTENSIONS` | _(empty = all)_ | Comma list, e.g. `pdf,png,jpg` |
| `UPLOAD_ALLOWED_MIME_TYPES` | _(empty = all)_ | Comma list, e.g. `image/*,application/pdf` |
| `FILE_DEFAULT_BUCKET` | _(none)_ | Default bucket when omitted (or only one accessible bucket) |

## Upload

```http
POST /api/v1/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

file=<binary>
bucket=my-uploads
module=crm
tags=a,b
```

Response:

```json
{
  "success": true,
  "data": {
    "fileId": "...",
    "path": "crm/2026/07/...-photo.jpg",
    "url": "http://.../api/v1/files/.../download",
    "size": "204800",
    "hash": "<sha256>",
    "metadata": { }
  }
}
```

Batch: `POST /api/v1/files/upload/batch` with field `files` (multiple).

## Download

- By Id: `GET /api/v1/files/:id/download`
- By path: `GET /api/v1/files/download/by-path?path=...&bucket=...`

## Metadata

- Get: `GET /api/v1/files/:id` or `GET /api/v1/files/by-path?path=`
- Update: `PATCH /api/v1/files/:id` — description, tags, module, customMetadata, folderId
- Search: `GET /api/v1/files?name=&module=&ownerId=&extension=&minSize=&maxSize=&createdFrom=&createdTo=`

## Delete

```http
DELETE /api/v1/files
{ "ids": ["..."], "hard": false }
```

Also accepts `paths` (+ optional `bucket`). Soft delete when enabled; `POST /files/:id/restore`, `DELETE /files/:id/purge`.

## Folders

- List / roots: `GET /api/v1/folders?rootsOnly=true&projectId=`
- Binding list: `GET /api/v1/folders/bindings?projectId=`
- Search: `GET /api/v1/folders/search?q=`
- Create: `POST /api/v1/folders`
- Rename / delete only if **not in use** (no files, no child folders)

## UI

- **Files** — `/files` — upload (batch), search filters, soft delete, trash restore/purge, edit metadata
- **Folders** — `/folders` — create, search code/name, roots filter, project binding list, rename/delete if unused
