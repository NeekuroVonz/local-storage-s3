import { apiDoc } from '../documented-endpoint.decorator';
import { API_BASE, EXAMPLE_PROJECT_ID, EXAMPLE_USER_ID, success } from '../examples/common.examples';

const fileExample = {
  id: 'f1111111-1111-1111-1111-111111111111',
  bucketName: 'my-uploads',
  objectKey: 'default/2026/07/f1111111-1111-1111-1111-111111111111-photo.jpg',
  path: 'default/2026/07/f1111111-1111-1111-1111-111111111111-photo.jpg',
  originalName: 'photo.jpg',
  contentType: 'image/jpeg',
  size: '204800',
  contentHash: 'a'.repeat(64),
  module: 'default',
  ownerId: EXAMPLE_USER_ID,
  projectId: EXAMPLE_PROJECT_ID,
  folderId: null,
  description: null,
  tags: ['inbox'],
  customMetadata: {},
  deletedAt: null,
  createdAt: '2026-07-08T04:00:00.000Z',
  updatedAt: '2026-07-08T04:00:00.000Z',
  url: `${API_BASE}/files/f1111111-1111-1111-1111-111111111111/download`,
};

export const FilesDocs = {
  upload: apiDoc({
    summary: 'Upload a single file',
    purpose: 'Store a file, compute hash, and return FileId + metadata.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    consumes: 'multipart/form-data',
    responseExample: success({
      fileId: fileExample.id,
      path: fileExample.path,
      url: fileExample.url,
      size: fileExample.size,
      hash: fileExample.contentHash,
      metadata: fileExample,
    }),
    curlExample: `curl -X POST ${API_BASE}/files/upload \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@./photo.jpg" \\
  -F "bucket=my-uploads" \\
  -F "module=crm"`,
  }),

  uploadBatch: apiDoc({
    summary: 'Upload multiple files',
    purpose: 'Upload many files in one request; returns per-file results.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    consumes: 'multipart/form-data',
    responseExample: success([
      { success: true, fileName: 'a.pdf', data: { fileId: fileExample.id, path: fileExample.path } },
      { success: false, fileName: 'bad.exe', error: 'File extension ".exe" is not allowed' },
    ]),
    curlExample: `curl -X POST ${API_BASE}/files/upload/batch \\
  -H "Authorization: Bearer <token>" \\
  -F "files=@./a.pdf" \\
  -F "files=@./b.pdf" \\
  -F "bucket=my-uploads"`,
  }),

  search: apiDoc({
    summary: 'Search file metadata',
    purpose: 'Filter by name, module, owner, date, extension, size.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    responseExample: success([fileExample]),
    curlExample: `curl "${API_BASE}/files?module=crm&extension=pdf&page=1" \\
  -H "Authorization: Bearer <token>"`,
  }),

  listModules: apiDoc({
    summary: 'List distinct file modules',
    purpose: 'Populate module filter dropdowns for accessible buckets.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    query: {
      bucket: { description: 'Optional bucket scope', required: false },
    },
    responseExample: success(['default', 'crm', 'billing']),
  }),

  getById: apiDoc({
    summary: 'Get file metadata by FileId',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    params: { id: { description: 'File UUID', example: fileExample.id } },
    responseExample: success(fileExample),
  }),

  getByPath: apiDoc({
    summary: 'Get file metadata by storage path',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    query: {
      path: { description: 'Logical storage path', example: fileExample.path, required: true },
      bucket: { description: 'Optional bucket filter', required: false },
    },
    responseExample: success(fileExample),
  }),

  downloadById: apiDoc({
    summary: 'Download file by FileId',
    purpose: 'Returns a binary stream with content-type and filename.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    params: { id: { description: 'File UUID', example: fileExample.id } },
    skipDefaultErrors: true,
    curlExample: `curl -O -J "${API_BASE}/files/${fileExample.id}/download" \\
  -H "Authorization: Bearer <token>"`,
  }),

  downloadByPath: apiDoc({
    summary: 'Download file by storage path',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    query: {
      path: { description: 'Logical storage path', required: true },
      bucket: { description: 'Optional bucket', required: false },
    },
    skipDefaultErrors: true,
  }),

  update: apiDoc({
    summary: 'Update file metadata',
    purpose: 'Update description, tags, module, custom metadata, folder.',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    params: { id: { description: 'File UUID', example: fileExample.id } },
    requestExample: {
      description: 'Invoice scan',
      tags: ['finance', '2026'],
      module: 'billing',
      customMetadata: { invoiceNo: 'INV-100' },
    },
    responseExample: success(fileExample),
  }),

  deleteMany: apiDoc({
    summary: 'Delete files by FileId or path',
    purpose: 'Soft-delete by default when FILE_SOFT_DELETE_ENABLED=true; pass hard=true to purge.',
    permissions: ['objects:delete'],
    auth: 'bearer-or-api-key',
    requestExample: { ids: [fileExample.id], hard: false },
    responseExample: success({ deletedIds: [fileExample.id], mode: 'soft' }),
  }),

  restore: apiDoc({
    summary: 'Restore soft-deleted file',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    params: { id: { description: 'File UUID', example: fileExample.id } },
    responseExample: success(fileExample),
  }),

  purge: apiDoc({
    summary: 'Permanently purge a file',
    permissions: ['objects:delete'],
    auth: 'bearer-or-api-key',
    params: { id: { description: 'File UUID', example: fileExample.id } },
    responseExample: { success: true, message: 'File purged' },
  }),
};

export const FoldersDocs = {
  list: apiDoc({
    summary: 'List folders',
    purpose: 'List folders; use rootsOnly=true for root folder management.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
  }),
  bindings: apiDoc({
    summary: 'Binding folder list for a project',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    query: {
      projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID, required: true },
    },
  }),
  search: apiDoc({
    summary: 'Search folders by code or name',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
  }),
  create: apiDoc({
    summary: 'Create folder',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    requestExample: {
      code: 'invoices',
      name: 'Invoices',
      bucketName: 'my-uploads',
      projectId: EXAMPLE_PROJECT_ID,
    },
  }),
  update: apiDoc({
    summary: 'Rename folder (only if not in use)',
    permissions: ['objects:write'],
    auth: 'bearer-or-api-key',
    requestExample: { name: 'Invoices 2026' },
  }),
  remove: apiDoc({
    summary: 'Delete folder (only if not in use)',
    permissions: ['objects:delete'],
    auth: 'bearer-or-api-key',
  }),
};
