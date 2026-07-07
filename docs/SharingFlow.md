# Sharing Flow

## Presigned URLs

Direct S3 presigned URLs for temporary access:

```
POST /buckets/:bucket/objects/presigned-url
{
  "key": "path/to/file.pdf",
  "operation": "getObject",
  "expiresIn": 3600
}

Response:
{
  "url": "http://garage:3900/bucket/path/to/file.pdf?X-Amz-...",
  "expiresAt": "2026-07-07T05:00:00.000Z"
}
```

Generated via `@aws-sdk/s3-request-presigner`. URL expires after configured duration (60s – 7 days).

## Share Links

Platform-managed share links with additional controls:

```
POST /shares
{
  "bucketName": "my-bucket",
  "objectKey": "documents/report.pdf",
  "expiresAt": "2026-07-14T00:00:00.000Z",
  "password": "secret",
  "maxDownloads": 10,
  "allowedIps": ["192.168.1.0/24"],
  "permission": "download"
}

Response:
{
  "url": "http://localhost:3000/share/abc-123-token",
  "expiresAt": "2026-07-14T00:00:00.000Z"
}
```

## Access Flow

```
User visits /share/:token
        │
        ▼
POST /shares/:token/access
{ "password": "secret" }
        │
        ├── Validate token exists & active
        ├── Check expiration
        ├── Check download limit
        ├── Check IP restriction
        ├── Verify password (if set)
        │
        ▼
Generate presigned S3 URL
        │
        ▼
Return download URL to client
```

## Share Controls

| Control | Description |
|---------|-------------|
| Expiration | Optional datetime after which link is invalid |
| Password | Optional bcrypt-hashed password protection |
| Max Downloads | Limit total download count |
| IP Restriction | Allow only specific IP addresses |
| Permission | `view` or `download` access level |

## Security

- Share tokens are UUIDs (unguessable)
- Passwords hashed with bcrypt
- Download count incremented atomically
- Shares can be revoked by owner
- All share actions logged in activity trail

## QR Code

Frontend can generate QR codes from share URLs using any QR library. The share dialog provides a copy-link button for easy sharing.
