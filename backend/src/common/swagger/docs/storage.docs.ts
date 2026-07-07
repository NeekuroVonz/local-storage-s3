import { apiDoc } from '../documented-endpoint.decorator';
import { API_BASE, success } from '../examples/common.examples';

export const BucketsDocs = {
  list: apiDoc({
    summary: 'List all buckets',
    purpose: 'Discover S3 buckets visible to the caller.',
    description:
      'Returns buckets the user can access. Project-scoped users only see buckets linked to their project memberships. Admins see all buckets. Optional `search` filters by name.',
    permissions: ['buckets:read'],
    auth: 'bearer-or-api-key',
    query: {
      search: { description: 'Filter buckets by name substring', example: 'uploads', required: false },
    },
    responseExample: success([
      {
        name: 'my-uploads',
        creationDate: '2026-07-01T10:00:00.000Z',
        region: 'garage',
        objectCount: 128,
        size: 52428800,
        versioning: false,
        publicAccess: false,
        tags: {},
      },
    ]),
    curlExample: `curl "${API_BASE}/buckets?search=upload" \\
  -H "Authorization: Bearer <token>"`,
  }),

  getOne: apiDoc({
    summary: 'Get bucket details',
    purpose: 'Fetch metadata and usage stats for one bucket.',
    description: 'Returns object count, total size, versioning flag, and tags.',
    permissions: ['buckets:read'],
    auth: 'bearer-or-api-key',
    params: { name: { description: 'S3 bucket name', example: 'my-uploads' } },
    responseExample: success({
      name: 'my-uploads',
      creationDate: '2026-07-01T10:00:00.000Z',
      region: 'garage',
      objectCount: 128,
      size: 52428800,
      versioning: false,
      publicAccess: false,
      tags: { env: 'production' },
    }),
    curlExample: `curl ${API_BASE}/buckets/my-uploads \\
  -H "Authorization: Bearer <token>"`,
  }),

  create: apiDoc({
    summary: 'Create a new bucket',
    purpose: 'Provision a new S3 bucket in the storage backend.',
    description:
      'Creates the bucket in Garage/S3 and stores platform metadata. Project-scoped users must use `POST /projects/:projectId/buckets` instead.',
    permissions: ['buckets:write'],
    auth: 'bearer',
    requestExample: {
      name: 'my-uploads',
      versioning: false,
      publicAccess: false,
      tags: { team: 'platform' },
    },
    responseExample: success({
      name: 'my-uploads',
      creationDate: '2026-07-07T08:00:00.000Z',
      versioning: false,
      publicAccess: false,
    }),
    curlExample: `curl -X POST ${API_BASE}/buckets \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"my-uploads","versioning":false,"publicAccess":false}'`,
  }),

  update: apiDoc({
    summary: 'Update bucket settings',
    purpose: 'Change versioning, public access, or tags.',
    permissions: ['buckets:write'],
    auth: 'bearer',
    params: { name: { description: 'Bucket name', example: 'my-uploads' } },
    requestExample: { versioning: true, publicAccess: false, tags: { env: 'staging' } },
    responseExample: success({ name: 'my-uploads', versioning: true, publicAccess: false }),
    curlExample: `curl -X PATCH ${API_BASE}/buckets/my-uploads \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"versioning":true}'`,
  }),

  remove: apiDoc({
    summary: 'Delete a bucket',
    purpose: 'Remove an empty bucket from storage and platform metadata.',
    description: 'Bucket must be empty. Also unlinks from any project.',
    permissions: ['buckets:delete'],
    auth: 'bearer',
    params: { name: { description: 'Bucket name', example: 'my-uploads' } },
    responseExample: { success: true, message: 'Bucket deleted' },
    curlExample: `curl -X DELETE ${API_BASE}/buckets/my-uploads \\
  -H "Authorization: Bearer <accessToken>"`,
  }),
};

export const ObjectsDocs = {
  list: apiDoc({
    summary: 'List objects in bucket',
    purpose: 'Browse folder contents with S3-style prefix listing.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    query: {
      prefix: { description: 'Folder prefix (e.g. `photos/`)', example: 'uploads/', required: false },
      delimiter: { description: 'Delimiter for folder grouping', example: '/', required: false },
      maxKeys: { description: 'Page size (max 1000)', example: 100, required: false },
      continuationToken: { description: 'Pagination token from previous response', required: false },
    },
    responseExample: success({
      objects: [
        {
          key: 'uploads/photo.jpg',
          name: 'photo.jpg',
          size: 204800,
          lastModified: '2026-07-07T08:00:00.000Z',
          isFolder: false,
          contentType: 'image/jpeg',
        },
      ],
      prefixes: ['uploads/thumbs/'],
      isTruncated: false,
      continuationToken: null,
    }),
    curlExample: `curl "${API_BASE}/buckets/my-uploads/objects?prefix=uploads/&delimiter=/" \\
  -H "Authorization: Bearer <token>"`,
  }),

  metadata: apiDoc({
    summary: 'Get object metadata',
    purpose: 'HEAD-style metadata lookup for a single object key.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    query: { key: { description: 'Full object key', example: 'uploads/photo.jpg', required: true } },
    responseExample: success({
      key: 'uploads/photo.jpg',
      size: 204800,
      contentType: 'image/jpeg',
      etag: '"abc123"',
      lastModified: '2026-07-07T08:00:00.000Z',
      metadata: {},
    }),
    curlExample: `curl "${API_BASE}/buckets/my-uploads/objects/metadata?key=uploads/photo.jpg" \\
  -H "Authorization: Bearer <token>"`,
  }),

  createFolder: apiDoc({
    summary: 'Create folder',
    purpose: 'Create a zero-byte folder marker object.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    requestExample: { path: 'uploads/2026/' },
    responseExample: success({ key: 'uploads/2026/', created: true }),
    curlExample: `curl -X POST ${API_BASE}/buckets/my-uploads/objects/folder \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"path":"uploads/2026/"}'`,
  }),

  rename: apiDoc({
    summary: 'Rename object',
    purpose: 'Rename a file or folder within the same bucket.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    requestExample: { sourceKey: 'uploads/old.jpg', destinationKey: 'uploads/new.jpg' },
    responseExample: success({ sourceKey: 'uploads/old.jpg', destinationKey: 'uploads/new.jpg' }),
    curlExample: `curl -X POST ${API_BASE}/buckets/my-uploads/objects/rename \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"sourceKey":"uploads/old.jpg","destinationKey":"uploads/new.jpg"}'`,
  }),

  copy: apiDoc({
    summary: 'Copy object',
    purpose: 'Server-side copy to a new key in the same bucket.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    requestExample: { sourceKey: 'uploads/a.jpg', destinationKey: 'archive/a.jpg' },
    responseExample: success({ destinationKey: 'archive/a.jpg' }),
    curlExample: `curl -X POST ${API_BASE}/buckets/my-uploads/objects/copy \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"sourceKey":"uploads/a.jpg","destinationKey":"archive/a.jpg"}'`,
  }),

  move: apiDoc({
    summary: 'Move object',
    purpose: 'Copy then delete — relocate an object to a new key.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    requestExample: { sourceKey: 'uploads/draft.pdf', destinationKey: 'published/draft.pdf' },
    responseExample: success({ destinationKey: 'published/draft.pdf' }),
    curlExample: `curl -X POST ${API_BASE}/buckets/my-uploads/objects/move \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"sourceKey":"uploads/draft.pdf","destinationKey":"published/draft.pdf"}'`,
  }),

  deleteMany: apiDoc({
    summary: 'Delete objects',
    purpose: 'Batch delete one or more object keys.',
    permissions: ['objects:delete'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    requestExample: { keys: ['uploads/a.jpg', 'uploads/b.jpg'] },
    responseExample: success({ deleted: 2, errors: [] }),
    curlExample: `curl -X DELETE ${API_BASE}/buckets/my-uploads/objects \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"keys":["uploads/a.jpg","uploads/b.jpg"]}'`,
  }),

  presignedUrl: apiDoc({
    summary: 'Generate presigned URL',
    purpose: 'Create a time-limited URL for direct download or upload.',
    description:
      'When `S3_PUBLIC_ENDPOINT` is configured, URLs are rewritten for external clients. Use for browser downloads without proxying through the API.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    requestExample: { key: 'uploads/photo.jpg', expiresIn: 3600, operation: 'getObject' },
    responseExample: success({
      url: 'https://storage.example.com/my-uploads/uploads/photo.jpg?X-Amz-Signature=...',
      expiresAt: '2026-07-07T09:00:00.000Z',
    }),
    curlExample: `curl -X POST ${API_BASE}/buckets/my-uploads/objects/presigned-url \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"uploads/photo.jpg","expiresIn":3600,"operation":"getObject"}'`,
  }),
};

export const UploadDocs = {
  simple: apiDoc({
    summary: 'Upload a file',
    purpose: 'Single-request upload for files that fit in memory.',
    description:
      'Multipart form upload. Field **`file`** = binary content. Query param **`key`** = destination object path. Triggers `object.created` webhook for project buckets.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    consumes: 'multipart/form-data',
    params: { bucket: { description: 'Destination bucket', example: 'my-uploads' } },
    query: { key: { description: 'Object key/path', example: 'uploads/photo.jpg', required: true } },
    responseExample: success({
      bucket: 'my-uploads',
      key: 'uploads/photo.jpg',
      size: 204800,
      etag: '"abc123"',
    }),
    curlExample: `curl -X POST "${API_BASE}/buckets/my-uploads/upload?key=uploads/photo.jpg" \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@./photo.jpg"`,
  }),

  initiateMultipart: apiDoc({
    summary: 'Initiate multipart upload',
    purpose: 'Start a large file upload session.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    requestExample: { key: 'videos/large.mp4', contentType: 'video/mp4' },
    responseExample: success({ uploadId: 'abc123upload', key: 'videos/large.mp4' }),
    curlExample: `curl -X POST ${API_BASE}/buckets/my-uploads/upload/multipart/initiate \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"videos/large.mp4","contentType":"video/mp4"}'`,
  }),

  uploadPart: apiDoc({
    summary: 'Upload a part',
    purpose: 'Upload one chunk of a multipart upload.',
    description: 'Multipart form with field **`file`**. Parts must be numbered starting at 1.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    consumes: 'multipart/form-data',
    params: {
      bucket: { description: 'Bucket name', example: 'my-uploads' },
      uploadId: { description: 'Upload session ID from initiate', example: 'abc123upload' },
    },
    query: {
      key: { description: 'Object key', example: 'videos/large.mp4', required: true },
      partNumber: { description: 'Part number (1-based)', example: 1, required: true },
    },
    responseExample: success({ etag: '"part-etag-1"', partNumber: 1 }),
    curlExample: `curl -X POST "${API_BASE}/buckets/my-uploads/upload/multipart/abc123upload/parts?key=videos/large.mp4&partNumber=1" \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@./part1.bin"`,
  }),

  completeMultipart: apiDoc({
    summary: 'Complete multipart upload',
    purpose: 'Assemble uploaded parts into the final object.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    query: { key: { description: 'Object key', example: 'videos/large.mp4', required: true } },
    requestExample: {
      uploadId: 'abc123upload',
      parts: [
        { partNumber: 1, etag: '"part-etag-1"' },
        { partNumber: 2, etag: '"part-etag-2"' },
      ],
    },
    responseExample: success({ key: 'videos/large.mp4', etag: '"final-etag"' }),
    curlExample: `curl -X POST "${API_BASE}/buckets/my-uploads/upload/multipart/complete?key=videos/large.mp4" \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"uploadId":"abc123upload","parts":[{"partNumber":1,"etag":"\\"part-etag-1\\""}]}'`,
  }),

  abortMultipart: apiDoc({
    summary: 'Abort multipart upload',
    purpose: 'Cancel an in-progress multipart upload and free parts.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    params: {
      bucket: { description: 'Bucket name', example: 'my-uploads' },
      uploadId: { description: 'Upload session ID', example: 'abc123upload' },
    },
    query: { key: { description: 'Object key', example: 'videos/large.mp4', required: true } },
    responseExample: { success: true, message: 'Multipart upload aborted' },
    curlExample: `curl -X DELETE "${API_BASE}/buckets/my-uploads/upload/multipart/abc123upload?key=videos/large.mp4" \\
  -H "Authorization: Bearer <token>"`,
  }),

  listParts: apiDoc({
    summary: 'List uploaded parts',
    purpose: 'Resume or verify multipart upload progress.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    params: {
      bucket: { description: 'Bucket name', example: 'my-uploads' },
      uploadId: { description: 'Upload session ID', example: 'abc123upload' },
    },
    query: { key: { description: 'Object key', example: 'videos/large.mp4', required: true } },
    responseExample: success({
      parts: [{ partNumber: 1, etag: '"part-etag-1"', size: 5242880 }],
    }),
    curlExample: `curl "${API_BASE}/buckets/my-uploads/upload/multipart/abc123upload/parts?key=videos/large.mp4" \\
  -H "Authorization: Bearer <token>"`,
  }),
};

export const DownloadDocs = {
  single: apiDoc({
    summary: 'Download an object',
    purpose: 'Stream a single object through the API.',
    description: 'Returns binary content with appropriate `Content-Type` and `Content-Disposition` headers.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    query: { key: { description: 'Object key', example: 'uploads/photo.jpg', required: true } },
    responseStatus: 200,
    skipDefaultErrors: true,
    curlExample: `curl -O "${API_BASE}/buckets/my-uploads/download?key=uploads/photo.jpg" \\
  -H "Authorization: Bearer <token>"`,
  }),

  zip: apiDoc({
    summary: 'Download multiple objects as ZIP',
    purpose: 'Bundle multiple files into a single ZIP archive.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    params: { bucket: { description: 'Bucket name', example: 'my-uploads' } },
    requestExample: { keys: ['uploads/a.jpg', 'uploads/b.jpg', 'docs/readme.txt'] },
    responseStatus: 200,
    skipDefaultErrors: true,
    curlExample: `curl -X POST ${API_BASE}/buckets/my-uploads/download/zip \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"keys":["uploads/a.jpg","uploads/b.jpg"]}' \\
  -o archive.zip`,
  }),
};
