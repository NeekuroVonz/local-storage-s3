export const Permission = {
  // Users
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE: 'users:manage',

  // Roles
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  ROLES_DELETE: 'roles:delete',

  // Buckets
  BUCKETS_READ: 'buckets:read',
  BUCKETS_WRITE: 'buckets:write',
  BUCKETS_DELETE: 'buckets:delete',
  BUCKETS_MANAGE: 'buckets:manage',

  // Objects
  OBJECTS_READ: 'objects:read',
  OBJECTS_WRITE: 'objects:write',
  OBJECTS_DELETE: 'objects:delete',
  OBJECTS_MANAGE: 'objects:manage',

  // Sharing
  SHARES_READ: 'shares:read',
  SHARES_WRITE: 'shares:write',
  SHARES_DELETE: 'shares:delete',

  // Admin
  ADMIN_READ: 'admin:read',
  ADMIN_WRITE: 'admin:write',
  SETTINGS_MANAGE: 'settings:manage',
  AUDIT_READ: 'audit:read',
  ANALYTICS_READ: 'analytics:read',

  // Projects / multi-tenant
  PROJECTS_READ: 'projects:read',
  PROJECTS_WRITE: 'projects:write',
  PROJECTS_MANAGE: 'projects:manage',
} as const;

export type PermissionName = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: PermissionName[] = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<string, PermissionName[]> = {
  admin: ALL_PERMISSIONS,
  manager: [
    Permission.USERS_READ,
    Permission.ROLES_READ,
    Permission.BUCKETS_READ,
    Permission.BUCKETS_WRITE,
    Permission.BUCKETS_DELETE,
    Permission.BUCKETS_MANAGE,
    Permission.OBJECTS_READ,
    Permission.OBJECTS_WRITE,
    Permission.OBJECTS_DELETE,
    Permission.OBJECTS_MANAGE,
    Permission.SHARES_READ,
    Permission.SHARES_WRITE,
    Permission.SHARES_DELETE,
    Permission.ANALYTICS_READ,
    Permission.AUDIT_READ,
    Permission.PROJECTS_READ,
    Permission.PROJECTS_WRITE,
    Permission.PROJECTS_MANAGE,
  ],
  operator: [
    Permission.BUCKETS_READ,
    Permission.BUCKETS_WRITE,
    Permission.OBJECTS_READ,
    Permission.OBJECTS_WRITE,
    Permission.OBJECTS_DELETE,
    Permission.SHARES_READ,
    Permission.SHARES_WRITE,
    Permission.ANALYTICS_READ,
    Permission.PROJECTS_READ,
  ],
  viewer: [
    Permission.BUCKETS_READ,
    Permission.OBJECTS_READ,
    Permission.SHARES_READ,
    Permission.ANALYTICS_READ,
    Permission.PROJECTS_READ,
  ],
  guest: [Permission.BUCKETS_READ, Permission.OBJECTS_READ],
};
