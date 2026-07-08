import { apiDoc } from '../documented-endpoint.decorator';
import {
  API_BASE,
  EXAMPLE_PROJECT_ID,
  EXAMPLE_USER_ID,
  paginated,
  success,
} from '../examples/common.examples';

export const SearchDocs = {
  search: apiDoc({
    summary: 'Search objects globally or in bucket',
    purpose: 'Find files by name/path across accessible buckets.',
    permissions: ['objects:read'],
    auth: 'bearer-or-api-key',
    query: {
      q: { description: 'Search query (name or path fragment)', example: 'invoice', required: true },
      bucket: { description: 'Limit to one bucket', example: 'my-uploads', required: false },
      prefix: { description: 'Folder prefix scope', example: 'docs/', required: false },
      limit: { description: 'Max results (default 50)', example: 50, required: false },
    },
    responseExample: success([
      { bucket: 'my-uploads', key: 'docs/invoice.pdf', name: 'invoice.pdf', size: 102400, lastModified: '2026-07-07T08:00:00.000Z' },
    ]),
    curlExample: `curl "${API_BASE}/search?q=invoice&limit=20" \\
  -H "Authorization: Bearer <token>"`,
  }),

  getSaved: apiDoc({
    summary: 'Get saved searches',
    permissions: ['objects:read'],
    auth: 'bearer',
    responseExample: success([{ id: 'search-uuid', name: 'PDF files', query: { q: '.pdf' } }]),
    curlExample: `curl ${API_BASE}/search/saved -H "Authorization: Bearer <accessToken>"`,
  }),

  saveSearch: apiDoc({
    summary: 'Save a search',
    permissions: ['objects:read'],
    auth: 'bearer',
    requestExample: { name: 'PDF files', query: { q: '.pdf', bucket: 'my-uploads' } },
    responseExample: success({ id: 'search-uuid', name: 'PDF files' }),
    curlExample: `curl -X POST ${API_BASE}/search/saved \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"PDF files","query":{"q":".pdf"}}'`,
  }),

  deleteSaved: apiDoc({
    summary: 'Delete saved search',
    permissions: ['objects:read'],
    auth: 'bearer',
    params: { id: { description: 'Saved search UUID', example: 'search-uuid' } },
    responseExample: { success: true, message: 'Saved search deleted' },
    curlExample: `curl -X DELETE ${API_BASE}/search/saved/search-uuid \\
  -H "Authorization: Bearer <accessToken>"`,
  }),
};

export const ShareDocs = {
  create: apiDoc({
    summary: 'Create a share link',
    purpose: 'Generate a public or password-protected link to an object.',
    permissions: ['shares:write'],
    auth: 'bearer',
    requestExample: {
      bucketName: 'my-uploads',
      objectKey: 'public/photo.jpg',
      permission: 'read',
      expiresAt: '2026-08-01T00:00:00.000Z',
      maxDownloads: 100,
    },
    responseExample: success({
      id: 'share-uuid',
      token: 'abc123token',
      url: 'http://localhost:3000/share/abc123token',
    }),
    curlExample: `curl -X POST ${API_BASE}/shares \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"bucketName":"my-uploads","objectKey":"public/photo.jpg","permission":"read"}'`,
  }),

  list: apiDoc({
    summary: 'List user shares',
    permissions: ['shares:read'],
    auth: 'bearer',
    responseExample: success([
      {
        id: 'share-uuid',
        bucketName: 'my-uploads',
        objectKey: 'public/photo.jpg',
        permission: 'read',
        downloadCount: 5,
        active: true,
      },
    ]),
    curlExample: `curl ${API_BASE}/shares -H "Authorization: Bearer <accessToken>"`,
  }),

  revoke: apiDoc({
    summary: 'Revoke a share',
    permissions: ['shares:delete'],
    auth: 'bearer',
    params: { id: { description: 'Share UUID', example: 'share-uuid' } },
    responseExample: { success: true, message: 'Share revoked' },
    curlExample: `curl -X DELETE ${API_BASE}/shares/share-uuid \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  access: apiDoc({
    summary: 'Access a shared object',
    purpose: 'Public endpoint to download a shared object by token.',
    auth: 'public',
    params: { token: { description: 'Share token from create response', example: 'abc123token' } },
    requestExample: { password: 'optional-share-password' },
    responseExample: { success: true, data: { downloadUrl: 'https://...', expiresAt: '2026-08-01T00:00:00.000Z' } },
    curlExample: `curl -X POST ${API_BASE}/shares/abc123token/access \\
  -H "Content-Type: application/json" \\
  -d '{}'`,
  }),
};

export const UsersDocs = {
  list: apiDoc({
    summary: 'List users',
    purpose: 'Paginated user directory for admin UI.',
    permissions: ['users:read'],
    auth: 'bearer',
    query: {
      page: { description: 'Page number (1-based)', example: 1, required: false },
      limit: { description: 'Page size', example: 50, required: false },
      search: { description: 'Search by name or email', example: 'admin', required: false },
    },
    responseExample: paginated([
      {
        id: EXAMPLE_USER_ID,
        email: 'admin@storage.local',
        firstName: 'System',
        lastName: 'Admin',
        status: 'ACTIVE',
        role: { name: 'admin', displayName: 'Admin' },
        projects: [{ id: EXAMPLE_PROJECT_ID, name: 'Default', role: 'OWNER' }],
      },
    ]),
    curlExample: `curl "${API_BASE}/users?page=1&limit=50" \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  create: apiDoc({
    summary: 'Create user (admin)',
    purpose: 'Create a platform user with role and optional project memberships (bucket access via projects).',
    permissions: ['users:manage'],
    auth: 'bearer',
    requestExample: {
      email: 'operator@acme.com',
      password: 'Operator123!',
      firstName: 'Ops',
      lastName: 'User',
      roleId: 'role-uuid',
      status: 'ACTIVE',
      projectIds: [EXAMPLE_PROJECT_ID],
      projectRole: 'MEMBER',
    },
    responseExample: success({
      id: EXAMPLE_USER_ID,
      email: 'operator@acme.com',
      role: { name: 'operator', displayName: 'Operator' },
    }),
    curlExample: `curl -X POST ${API_BASE}/users \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"operator@acme.com","password":"Operator123!","firstName":"Ops","lastName":"User","roleId":"<roleId>","projectIds":["<projectId>"]}'`,
  }),

  getOne: apiDoc({
    summary: 'Get user details',
    permissions: ['users:read'],
    auth: 'bearer',
    params: { id: { description: 'User UUID', example: EXAMPLE_USER_ID } },
    responseExample: success({
      id: EXAMPLE_USER_ID,
      email: 'admin@storage.local',
      firstName: 'System',
      lastName: 'Admin',
    }),
    curlExample: `curl ${API_BASE}/users/${EXAMPLE_USER_ID} -H "Authorization: Bearer <accessToken>"`,
  }),

  updateRole: apiDoc({
    summary: 'Update user role',
    permissions: ['users:manage'],
    auth: 'bearer',
    params: { id: { description: 'User UUID', example: EXAMPLE_USER_ID } },
    requestExample: { roleId: 'role-uuid' },
    responseExample: success({ id: EXAMPLE_USER_ID, roleId: 'role-uuid' }),
    curlExample: `curl -X PATCH ${API_BASE}/users/${EXAMPLE_USER_ID}/role \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"roleId":"role-uuid"}'`,
  }),

  updateStatus: apiDoc({
    summary: 'Update user status',
    permissions: ['users:manage'],
    auth: 'bearer',
    params: { id: { description: 'User UUID', example: EXAMPLE_USER_ID } },
    requestExample: { status: 'ACTIVE' },
    responseExample: success({ id: EXAMPLE_USER_ID, status: 'ACTIVE' }),
    curlExample: `curl -X PATCH ${API_BASE}/users/${EXAMPLE_USER_ID}/status \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"SUSPENDED"}'`,
  }),

  updateProjects: apiDoc({
    summary: 'Assign user to projects',
    purpose: 'Replace project memberships. Bucket access follows project-linked buckets.',
    permissions: ['users:manage'],
    auth: 'bearer',
    params: { id: { description: 'User UUID', example: EXAMPLE_USER_ID } },
    requestExample: { projectIds: [EXAMPLE_PROJECT_ID], projectRole: 'MEMBER' },
    responseExample: success({
      id: EXAMPLE_USER_ID,
      projects: [{ id: EXAMPLE_PROJECT_ID, name: 'Default', role: 'MEMBER' }],
    }),
  }),
};

export const RolesDocs = {
  list: apiDoc({
    summary: 'List roles',
    permissions: ['roles:read'],
    auth: 'bearer',
    responseExample: success([
      { id: 'role-uuid', name: 'admin', displayName: 'Admin', permissions: ['buckets:read'] },
    ]),
    curlExample: `curl ${API_BASE}/roles -H "Authorization: Bearer <accessToken>"`,
  }),

  listPermissions: apiDoc({
    summary: 'List all permissions',
    permissions: ['roles:read'],
    auth: 'bearer',
    responseExample: success(['buckets:read', 'buckets:write', 'objects:read', 'projects:write']),
    curlExample: `curl ${API_BASE}/roles/permissions -H "Authorization: Bearer <accessToken>"`,
  }),

  create: apiDoc({
    summary: 'Create custom role',
    permissions: ['roles:write'],
    auth: 'bearer',
    requestExample: {
      name: 'uploader',
      displayName: 'Uploader',
      description: 'Can upload files only',
      permissions: ['objects:write', 'buckets:read'],
    },
    responseExample: success({ id: 'role-uuid', name: 'uploader' }),
    curlExample: `curl -X POST ${API_BASE}/roles \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"uploader","displayName":"Uploader","permissions":["objects:write"]}'`,
  }),

  updatePermissions: apiDoc({
    summary: 'Update role permissions',
    permissions: ['roles:write'],
    auth: 'bearer',
    params: { id: { description: 'Role UUID', example: 'role-uuid' } },
    requestExample: { permissions: ['objects:read', 'objects:write'] },
    responseExample: success({ id: 'role-uuid', permissions: ['objects:read', 'objects:write'] }),
    curlExample: `curl -X PATCH ${API_BASE}/roles/role-uuid/permissions \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"permissions":["objects:read","objects:write"]}'`,
  }),
};

export const DashboardDocs = {
  stats: apiDoc({
    summary: 'Get dashboard statistics',
    purpose: 'Aggregate metrics for the dashboard UI.',
    permissions: ['analytics:read'],
    auth: 'bearer',
    responseExample: success({
      totalBuckets: 5,
      totalObjects: 1280,
      storageUsed: 524288000,
      uploadsToday: 42,
      downloadsToday: 18,
      activeUsers: 3,
      storageGrowth: 2.5,
    }),
    curlExample: `curl ${API_BASE}/dashboard/stats -H "Authorization: Bearer <accessToken>"`,
  }),

  activity: apiDoc({
    summary: 'Get recent activity',
    purpose: 'Latest audit events for dashboard widget.',
    permissions: ['analytics:read'],
    auth: 'bearer',
    responseExample: success([
      {
        id: 'act-uuid',
        action: 'OBJECT_UPLOADED',
        resource: 'my-uploads/uploads/photo.jpg',
        createdAt: '2026-07-07T08:00:00.000Z',
      },
    ]),
    curlExample: `curl ${API_BASE}/dashboard/activity -H "Authorization: Bearer <accessToken>"`,
  }),
};

export const ActivityDocs = {
  list: apiDoc({
    summary: 'List activity logs',
    purpose: 'Full audit log with pagination and filters.',
    permissions: ['audit:read'],
    auth: 'bearer',
    query: {
      userId: { description: 'Filter by user UUID', required: false },
      action: { description: 'Filter by action enum', example: 'OBJECT_UPLOADED', required: false },
      page: { description: 'Page number', example: 1, required: false },
      limit: { description: 'Page size', example: 20, required: false },
    },
    responseExample: paginated([
      {
        id: 'act-uuid',
        action: 'OBJECT_UPLOADED',
        userId: EXAMPLE_USER_ID,
        resource: 'my-uploads/uploads/photo.jpg',
        createdAt: '2026-07-07T08:00:00.000Z',
      },
    ]),
    curlExample: `curl "${API_BASE}/activity?page=1&limit=20" \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  export: apiDoc({
    summary: 'Export activity logs as CSV',
    purpose: 'Download audit trail for compliance.',
    permissions: ['audit:read'],
    auth: 'bearer',
    query: { userId: { description: 'Optional user filter', required: false } },
    responseStatus: 200,
    description: 'Returns `text/csv` file attachment.',
    skipDefaultErrors: true,
    curlExample: `curl "${API_BASE}/activity/export" \\
  -H "Authorization: Bearer <accessToken>" \\
  -o activity-logs.csv`,
  }),
};

export const AnalyticsDocs = {
  get: apiDoc({
    summary: 'Get storage analytics',
    purpose: 'Time-series and breakdown analytics for storage usage.',
    permissions: ['analytics:read'],
    auth: 'bearer',
    responseExample: success({
      totalStorage: 524288000,
      totalObjects: 1280,
      byBucket: [{ bucket: 'my-uploads', size: 524288000, objects: 1280 }],
      growth: [{ date: '2026-07-01', bytes: 500000000 }],
    }),
    curlExample: `curl ${API_BASE}/analytics -H "Authorization: Bearer <accessToken>"`,
  }),
};

export const SettingsDocs = {
  getAll: apiDoc({
    summary: 'Get all settings',
    permissions: ['settings:manage'],
    auth: 'bearer',
    responseExample: success({ maxUploadSize: 104857600, maintenanceMode: false }),
    curlExample: `curl ${API_BASE}/settings -H "Authorization: Bearer <accessToken>"`,
  }),

  getOne: apiDoc({
    summary: 'Get setting by key',
    permissions: ['settings:manage'],
    auth: 'bearer',
    params: { key: { description: 'Setting key', example: 'maxUploadSize' } },
    responseExample: success({ key: 'maxUploadSize', value: 104857600 }),
    curlExample: `curl ${API_BASE}/settings/maxUploadSize -H "Authorization: Bearer <accessToken>"`,
  }),

  set: apiDoc({
    summary: 'Update setting',
    permissions: ['settings:manage'],
    auth: 'bearer',
    params: { key: { description: 'Setting key', example: 'maxUploadSize' } },
    requestExample: { value: 209715200 },
    responseExample: success({ key: 'maxUploadSize', value: 209715200 }),
    curlExample: `curl -X PUT ${API_BASE}/settings/maxUploadSize \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"value":209715200}'`,
  }),
};

export const AdminDocs = {
  health: apiDoc({
    summary: 'System health overview',
    purpose: 'Check Postgres, Redis, and S3 connectivity.',
    permissions: ['admin:read'],
    auth: 'bearer',
    responseExample: success({
      postgres: 'healthy',
      redis: 'healthy',
      s3: 'healthy',
      timestamp: '2026-07-07T08:00:00.000Z',
    }),
    curlExample: `curl ${API_BASE}/admin/health -H "Authorization: Bearer <accessToken>"`,
  }),

  stats: apiDoc({
    summary: 'System statistics',
    permissions: ['admin:read'],
    auth: 'bearer',
    responseExample: success({
      userCount: 10,
      roleCount: 4,
      activityCount: 5000,
      activeUploads: 2,
    }),
    curlExample: `curl ${API_BASE}/admin/stats -H "Authorization: Bearer <accessToken>"`,
  }),
};

export const HealthDocs = {
  health: apiDoc({
    summary: 'Health check',
    purpose: 'Basic liveness — API process is running.',
    auth: 'public',
    responseExample: { status: 'ok', timestamp: '2026-07-07T08:00:00.000Z' },
    skipDefaultErrors: true,
    curlExample: `curl ${API_BASE}/health`,
  }),

  ready: apiDoc({
    summary: 'Readiness probe',
    purpose: 'Kubernetes readiness — DB and Redis reachable.',
    auth: 'public',
    responseExample: { status: 'ready', timestamp: '2026-07-07T08:00:00.000Z' },
    skipDefaultErrors: true,
    curlExample: `curl ${API_BASE}/health/ready`,
  }),

  live: apiDoc({
    summary: 'Liveness probe',
    purpose: 'Kubernetes liveness — process alive.',
    auth: 'public',
    responseExample: { status: 'alive', timestamp: '2026-07-07T08:00:00.000Z' },
    skipDefaultErrors: true,
    curlExample: `curl ${API_BASE}/health/live`,
  }),
};

export const NotificationsDocs = {
  list: apiDoc({
    summary: 'List notifications',
    auth: 'bearer',
    query: { unreadOnly: { description: 'If true, only unread', example: true, required: false } },
    responseExample: success([
      { id: 'notif-uuid', title: 'Upload complete', read: false, createdAt: '2026-07-07T08:00:00.000Z' },
    ]),
    curlExample: `curl "${API_BASE}/notifications?unreadOnly=true" \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  unreadCount: apiDoc({
    summary: 'Get unread notification count',
    auth: 'bearer',
    responseExample: success({ count: 3 }),
    curlExample: `curl ${API_BASE}/notifications/unread-count \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  markAsRead: apiDoc({
    summary: 'Mark notification as read',
    auth: 'bearer',
    params: { id: { description: 'Notification UUID', example: 'notif-uuid' } },
    responseExample: success({ id: 'notif-uuid', read: true }),
    curlExample: `curl -X PATCH ${API_BASE}/notifications/notif-uuid/read \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  markAllAsRead: apiDoc({
    summary: 'Mark all notifications as read',
    auth: 'bearer',
    responseExample: success({ updated: 3 }),
    curlExample: `curl -X PATCH ${API_BASE}/notifications/read-all \\
  -H "Authorization: Bearer <accessToken>"`,
  }),
};
