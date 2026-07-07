import { apiDoc } from '../documented-endpoint.decorator';
import {
  API_BASE,
  EXAMPLE_ORG_ID,
  EXAMPLE_PROJECT_ID,
  EXAMPLE_USER_ID,
  success,
} from '../examples/common.examples';

export const OrganizationsDocs = {
  list: apiDoc({
    summary: 'List organizations',
    purpose: 'List top-level orgs that group projects/tenants.',
    permissions: ['projects:read'],
    auth: 'bearer',
    responseExample: success([
      {
        id: EXAMPLE_ORG_ID,
        name: 'platform-default',
        displayName: 'Platform',
        description: 'Default organization',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]),
    curlExample: `curl ${API_BASE}/organizations -H "Authorization: Bearer <accessToken>"`,
  }),

  create: apiDoc({
    summary: 'Create organization',
    purpose: 'Add a new organization for grouping projects.',
    permissions: ['projects:manage'],
    auth: 'bearer',
    requestExample: {
      name: 'acme-corp',
      displayName: 'Acme Corporation',
      description: 'Customer organization',
    },
    responseExample: success({
      id: EXAMPLE_ORG_ID,
      name: 'acme-corp',
      displayName: 'Acme Corporation',
    }),
    curlExample: `curl -X POST ${API_BASE}/organizations \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"acme-corp","displayName":"Acme Corporation"}'`,
  }),

  update: apiDoc({
    summary: 'Update organization',
    permissions: ['projects:manage'],
    auth: 'bearer',
    params: { orgId: { description: 'Organization UUID', example: EXAMPLE_ORG_ID } },
    requestExample: { displayName: 'Acme Corp (Updated)', description: 'Updated description' },
    responseExample: success({ id: EXAMPLE_ORG_ID, displayName: 'Acme Corp (Updated)' }),
    curlExample: `curl -X PATCH ${API_BASE}/organizations/${EXAMPLE_ORG_ID} \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"displayName":"Acme Corp (Updated)"}'`,
  }),

  remove: apiDoc({
    summary: 'Delete organization',
    description: 'Deletes org and cascades to projects. Use with caution.',
    permissions: ['projects:manage'],
    auth: 'bearer',
    params: { orgId: { description: 'Organization UUID', example: EXAMPLE_ORG_ID } },
    responseExample: { success: true, message: 'Organization deleted' },
    curlExample: `curl -X DELETE ${API_BASE}/organizations/${EXAMPLE_ORG_ID} \\
  -H "Authorization: Bearer <accessToken>"`,
  }),
};

export const ProjectsDocs = {
  list: apiDoc({
    summary: 'List projects',
    purpose: 'List tenant projects visible to the caller.',
    description: 'Admins see all projects. Other users see projects they are members of.',
    permissions: ['projects:read'],
    auth: 'bearer',
    query: {
      organizationId: { description: 'Filter by organization UUID', example: EXAMPLE_ORG_ID, required: false },
    },
    responseExample: success([
      {
        id: EXAMPLE_PROJECT_ID,
        name: 'Default',
        slug: 'platform-default',
        organizationId: EXAMPLE_ORG_ID,
        buckets: [{ bucketName: 'my-uploads', isDefault: true }],
        _count: { members: 1 },
      },
    ]),
    curlExample: `curl ${API_BASE}/projects -H "Authorization: Bearer <accessToken>"`,
  }),

  getOne: apiDoc({
    summary: 'Get project details',
    purpose: 'Full project with buckets, members, and organization.',
    permissions: ['projects:read'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    responseExample: success({
      id: EXAMPLE_PROJECT_ID,
      name: 'Acme Tenant',
      slug: 'acme-tenant',
      buckets: [{ bucketName: 'acme-uploads', isDefault: true }],
      members: [{ userId: EXAMPLE_USER_ID, role: 'OWNER' }],
    }),
    curlExample: `curl ${API_BASE}/projects/${EXAMPLE_PROJECT_ID} -H "Authorization: Bearer <accessToken>"`,
  }),

  create: apiDoc({
    summary: 'Create project',
    purpose: 'Provision a new isolated tenant.',
    description: 'Creator is automatically added as project OWNER. Slug must be globally unique.',
    permissions: ['projects:write'],
    auth: 'bearer',
    requestExample: {
      organizationId: EXAMPLE_ORG_ID,
      name: 'Acme Tenant',
      slug: 'acme-tenant',
      description: 'Production tenant for Acme Corp',
    },
    responseExample: success({
      id: EXAMPLE_PROJECT_ID,
      name: 'Acme Tenant',
      slug: 'acme-tenant',
      message: 'Project created',
    }),
    curlExample: `curl -X POST ${API_BASE}/projects \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"organizationId":"${EXAMPLE_ORG_ID}","name":"Acme Tenant","slug":"acme-tenant"}'`,
  }),

  update: apiDoc({
    summary: 'Update project',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    requestExample: { name: 'Acme Tenant (Prod)', description: 'Updated' },
    responseExample: success({ id: EXAMPLE_PROJECT_ID, name: 'Acme Tenant (Prod)' }),
    curlExample: `curl -X PATCH ${API_BASE}/projects/${EXAMPLE_PROJECT_ID} \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Acme Tenant (Prod)"}'`,
  }),

  remove: apiDoc({
    summary: 'Delete project',
    description: 'Project must have no linked buckets.',
    permissions: ['projects:manage'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    responseExample: { success: true, message: 'Project deleted' },
    curlExample: `curl -X DELETE ${API_BASE}/projects/${EXAMPLE_PROJECT_ID} \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  addMember: apiDoc({
    summary: 'Add project member',
    purpose: 'Grant a platform user access to project buckets.',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    requestExample: { userId: EXAMPLE_USER_ID, role: 'MEMBER' },
    responseExample: success({ projectId: EXAMPLE_PROJECT_ID, userId: EXAMPLE_USER_ID, role: 'MEMBER' }),
    curlExample: `curl -X POST ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/members \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"userId":"${EXAMPLE_USER_ID}","role":"MEMBER"}'`,
  }),

  removeMember: apiDoc({
    summary: 'Remove project member',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: {
      projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID },
      userId: { description: 'User UUID to remove', example: EXAMPLE_USER_ID },
    },
    responseExample: { success: true, message: 'Member removed' },
    curlExample: `curl -X DELETE ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/members/${EXAMPLE_USER_ID} \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  createBucket: apiDoc({
    summary: 'Create bucket and link to project',
    purpose: 'Provision tenant-isolated storage.',
    description: 'Creates S3 bucket and links exclusively to this project. Auto-grants S3 credentials if provisioned.',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    requestExample: {
      name: 'acme-uploads',
      versioning: false,
      publicAccess: false,
      isDefault: true,
    },
    responseExample: success({
      projectId: EXAMPLE_PROJECT_ID,
      bucketName: 'acme-uploads',
      isDefault: true,
    }),
    curlExample: `curl -X POST ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/buckets \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"acme-uploads","isDefault":true}'`,
  }),

  linkBucket: apiDoc({
    summary: 'Link existing bucket to project',
    purpose: 'Assign an unlinked bucket to a tenant.',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    requestExample: { bucketName: 'legacy-bucket', isDefault: false },
    responseExample: success({ bucketName: 'legacy-bucket', isDefault: false }),
    curlExample: `curl -X POST ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/buckets/link \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"bucketName":"legacy-bucket"}'`,
  }),

  unlinkBucket: apiDoc({
    summary: 'Unlink bucket from project',
    description: 'Removes project association; bucket remains in S3.',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: {
      projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID },
      bucketName: { description: 'Bucket name', example: 'acme-uploads' },
    },
    responseExample: { success: true, message: 'Bucket unlinked from project' },
    curlExample: `curl -X DELETE ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/buckets/acme-uploads \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  listApiKeys: apiDoc({
    summary: 'List project API keys',
    purpose: 'List machine-to-machine keys (secrets are never returned).',
    permissions: ['projects:read'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    responseExample: success([
      {
        id: 'key-uuid',
        name: 'nextjs-backend',
        keyPrefix: 'sk_live_abcd',
        environment: 'live',
        lastUsedAt: null,
      },
    ]),
    curlExample: `curl ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/api-keys \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  createApiKey: apiDoc({
    summary: 'Create API key (secret shown once)',
    purpose: 'Issue M2M credentials scoped to project buckets.',
    description: 'Full secret returned only in this response. Store it securely.',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    requestExample: {
      name: 'nextjs-backend',
      permissions: ['objects:read', 'objects:write', 'buckets:read'],
      bucketNames: [],
      environment: 'live',
    },
    responseExample: success({
      id: 'key-uuid',
      name: 'nextjs-backend',
      key: 'sk_live_abcd1234.secretShownOnce',
      keyPrefix: 'sk_live_abcd',
    }),
    curlExample: `curl -X POST ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/api-keys \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"nextjs-backend","permissions":["objects:read","objects:write"],"environment":"live"}'`,
  }),

  revokeApiKey: apiDoc({
    summary: 'Revoke API key',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: {
      projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID },
      keyId: { description: 'API key UUID', example: 'key-uuid' },
    },
    responseExample: { success: true, message: 'API key revoked' },
    curlExample: `curl -X DELETE ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/api-keys/key-uuid \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  listGrants: apiDoc({
    summary: 'List bucket access grants',
    purpose: 'Prefix-scoped ACLs for users or API keys.',
    permissions: ['projects:read'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    query: {
      bucketName: { description: 'Filter by bucket', example: 'acme-uploads', required: false },
    },
    responseExample: success([
      {
        id: 'grant-uuid',
        bucketName: 'acme-uploads',
        prefix: 'uploads/',
        subjectType: 'USER',
        subjectId: EXAMPLE_USER_ID,
      },
    ]),
    curlExample: `curl "${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/grants?bucketName=acme-uploads" \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  createGrant: apiDoc({
    summary: 'Create bucket access grant',
    purpose: 'Restrict user/API key to folder prefix within a project bucket.',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    requestExample: {
      bucketName: 'acme-uploads',
      subjectType: 'USER',
      subjectId: EXAMPLE_USER_ID,
      prefix: 'uploads/',
      permissions: ['objects:read', 'objects:write'],
    },
    responseExample: success({ id: 'grant-uuid', prefix: 'uploads/' }),
    curlExample: `curl -X POST ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/grants \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"bucketName":"acme-uploads","subjectType":"USER","subjectId":"${EXAMPLE_USER_ID}","prefix":"uploads/","permissions":["objects:read","objects:write"]}'`,
  }),

  removeGrant: apiDoc({
    summary: 'Remove bucket access grant',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: {
      projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID },
      grantId: { description: 'Grant UUID', example: 'grant-uuid' },
    },
    responseExample: { success: true, message: 'Grant removed' },
    curlExample: `curl -X DELETE ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/grants/grant-uuid \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  getS3Credentials: apiDoc({
    summary: 'Get project S3 credential status',
    purpose: 'Check if per-tenant Garage keys are provisioned.',
    permissions: ['projects:read'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    responseExample: success({
      provisioned: true,
      accessKeyId: 'GK...',
      endpoint: 'http://localhost:3900',
      garageAdminConfigured: true,
    }),
    curlExample: `curl ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/s3-credentials \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  provisionS3Credentials: apiDoc({
    summary: 'Provision per-tenant S3 credentials (secret shown once)',
    purpose: 'Create Garage key scoped to project buckets for direct SDK access.',
    description: 'Requires GARAGE_ADMIN_ENDPOINT and GARAGE_ADMIN_TOKEN. Secret returned once.',
    permissions: ['projects:manage'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    responseExample: success({
      accessKeyId: 'GK...',
      secretAccessKey: 'shown-once-secret',
      endpoint: 'http://localhost:3900',
      region: 'garage',
    }),
    curlExample: `curl -X POST ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/s3-credentials/provision \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  rotateS3Credentials: apiDoc({
    summary: 'Rotate project S3 credentials (new secret shown once)',
    permissions: ['projects:manage'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    responseExample: success({
      accessKeyId: 'GK-new',
      secretAccessKey: 'new-shown-once-secret',
    }),
    curlExample: `curl -X POST ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/s3-credentials/rotate \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  revokeS3Credentials: apiDoc({
    summary: 'Revoke project S3 credentials',
    permissions: ['projects:manage'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    responseExample: { success: true, message: 'S3 credentials revoked' },
    curlExample: `curl -X DELETE ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/s3-credentials \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  listWebhooks: apiDoc({
    summary: 'List project webhooks',
    permissions: ['projects:read'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    responseExample: success([
      { id: 'wh-uuid', name: 'object-events', url: 'https://api.acme.com/webhooks/storage', events: ['object.created'] },
    ]),
    curlExample: `curl ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/webhooks \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  createWebhook: apiDoc({
    summary: 'Create webhook (signing secret shown once)',
    purpose: 'Notify external systems on object.created / object.deleted.',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    requestExample: {
      name: 'object-events',
      url: 'https://api.acme.com/webhooks/storage',
      events: ['object.created', 'object.deleted'],
    },
    responseExample: success({
      id: 'wh-uuid',
      secret: 'whsec_shown_once',
      url: 'https://api.acme.com/webhooks/storage',
    }),
    curlExample: `curl -X POST ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/webhooks \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"object-events","url":"https://api.acme.com/webhooks/storage","events":["object.created"]}'`,
  }),

  removeWebhook: apiDoc({
    summary: 'Remove webhook',
    permissions: ['projects:write'],
    auth: 'bearer',
    params: {
      projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID },
      webhookId: { description: 'Webhook UUID', example: 'wh-uuid' },
    },
    responseExample: { success: true, message: 'Webhook removed' },
    curlExample: `curl -X DELETE ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/webhooks/wh-uuid \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  listWebhookDeliveries: apiDoc({
    summary: 'List webhook delivery attempts',
    purpose: 'Debug webhook delivery failures and retries.',
    permissions: ['projects:read'],
    auth: 'bearer',
    params: {
      projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID },
      webhookId: { description: 'Webhook UUID', example: 'wh-uuid' },
    },
    responseExample: success([
      { id: 'del-uuid', status: 'success', statusCode: 200, attemptedAt: '2026-07-07T08:00:00.000Z' },
    ]),
    curlExample: `curl ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/webhooks/wh-uuid/deliveries \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  getQuotas: apiDoc({
    summary: 'Get project quotas and usage',
    purpose: 'Monitor storage limits across project buckets.',
    permissions: ['projects:read'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    responseExample: success({
      maxStorageBytes: '10737418240',
      maxObjectCount: 100000,
      usage: { storageBytes: '524288000', objectCount: 1280 },
    }),
    curlExample: `curl ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/quotas \\
  -H "Authorization: Bearer <accessToken>"`,
  }),

  updateQuotas: apiDoc({
    summary: 'Update project storage quotas',
    permissions: ['projects:manage'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    requestExample: { maxStorageBytes: '10737418240', maxObjectCount: 100000 },
    responseExample: success({ maxStorageBytes: '10737418240', maxObjectCount: 100000 }),
    curlExample: `curl -X PATCH ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/quotas \\
  -H "Authorization: Bearer <accessToken>" \\
  -H "Content-Type: application/json" \\
  -d '{"maxStorageBytes":"10737418240","maxObjectCount":100000}'`,
  }),

  reconcileQuotas: apiDoc({
    summary: 'Reconcile project usage from storage backend',
    purpose: 'Recalculate usage counters from actual S3 bucket stats.',
    permissions: ['projects:manage'],
    auth: 'bearer',
    params: { projectId: { description: 'Project UUID', example: EXAMPLE_PROJECT_ID } },
    responseExample: success({ storageBytes: '524288000', objectCount: 1280 }),
    curlExample: `curl -X POST ${API_BASE}/projects/${EXAMPLE_PROJECT_ID}/quotas/reconcile \\
  -H "Authorization: Bearer <accessToken>"`,
  }),
};
