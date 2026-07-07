# Upload Flow

## Simple Upload (< 5MB)

```
Frontend                    Backend                     S3 (Garage)
   │                           │                           │
   │── POST /upload ──────────▶│                           │
   │   (multipart/form-data)   │── PutObject ─────────────▶│
   │                           │◀── ETag ──────────────────│
   │◀── { etag, key } ────────│                           │
   │                           │── Log activity ──▶ DB     │
   │                           │── Record metric ─▶ DB     │
```

## Multipart Upload (≥ 5MB)

```
Frontend                    Backend                     S3 (Garage)
   │                           │                           │
   │── POST /multipart/init ──▶│                           │
   │                           │── CreateMultipartUpload ─▶│
   │◀── { uploadId } ─────────│◀── UploadId ──────────────│
   │                           │                           │
   │── POST /parts (×N) ─────▶│                           │
   │   (chunk data)            │── UploadPart ────────────▶│
   │◀── { etag, partNumber } ─│◀── ETag ──────────────────│
   │                           │                           │
   │── POST /complete ────────▶│                           │
   │   { parts: [...] }        │── CompleteMultipartUpload▶│
   │◀── { etag, location } ───│◀── Result ────────────────│
```

## Frontend Upload Queue

The upload queue is managed via Zustand (`useUploadStore`):

1. Files added to queue with status `pending`
2. Upload starts → status `uploading`, progress tracked
3. Success → status `completed`
4. Failure → status `failed` with error message

Features:
- Drag & drop anywhere in the explorer
- Upload dialog for file selection
- Progress bar per file
- Background upload (queue persists during navigation)
- Automatic retry on token refresh

## Upload Job Tracking

Multipart uploads are tracked in the `upload_jobs` table:
- Status: pending → in_progress → completed / aborted / failed
- Parts stored as JSON for resume capability
- Linked to user for audit trail

## Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Multipart threshold | 5 MB | `upload.service.ts` |
| Max part number | 10,000 | S3 API limit |
| Max keys per delete | 1,000 | S3 API limit |
