# Permission System

## Overview

The platform uses Role-Based Access Control (RBAC) with a permission matrix. Permissions are checked at the API level via guards on every protected endpoint.

## System Roles

| Role | Level | Description |
|------|-------|-------------|
| admin | 100 | Full system access |
| manager | 80 | Bucket and user management |
| operator | 60 | Upload, download, object operations |
| viewer | 40 | Read-only access |
| guest | 20 | Minimal read access |

Custom roles can be created with any permission combination.

## Permissions

| Permission | Category | Description |
|-----------|----------|-------------|
| users:read | Users | View user list and profiles |
| users:write | Users | Create and update users |
| users:delete | Users | Delete users |
| users:manage | Users | Full user management |
| roles:read | Roles | View roles and permissions |
| roles:write | Roles | Create and modify roles |
| roles:delete | Roles | Delete custom roles |
| buckets:read | Buckets | List and view buckets |
| buckets:write | Buckets | Create and update buckets |
| buckets:delete | Buckets | Delete buckets |
| buckets:manage | Buckets | Full bucket management |
| objects:read | Objects | List and view objects |
| objects:write | Objects | Upload, rename, copy, move |
| objects:delete | Objects | Delete objects |
| objects:manage | Objects | Full object management |
| shares:read | Sharing | View share links |
| shares:write | Sharing | Create share links |
| shares:delete | Sharing | Revoke share links |
| admin:read | Admin | View system health and stats |
| admin:write | Admin | Modify system configuration |
| settings:manage | Admin | Manage global settings |
| audit:read | Audit | View activity and audit logs |
| analytics:read | Analytics | View storage analytics |

## Role-Permission Matrix

| Permission | admin | manager | operator | viewer | guest |
|-----------|-------|---------|----------|--------|-------|
| users:* | ✓ | read | — | — | — |
| roles:* | ✓ | read | — | — | — |
| buckets:* | ✓ | ✓ | read/write | read | read |
| objects:* | ✓ | ✓ | read/write/delete | read | read |
| shares:* | ✓ | ✓ | read/write | read | — |
| analytics:read | ✓ | ✓ | ✓ | ✓ | — |
| audit:read | ✓ | ✓ | — | — | — |
| admin:* | ✓ | — | — | — | — |
| settings:manage | ✓ | — | — | — | — |

## Implementation

Permissions are defined in `packages/shared/src/constants/permissions.ts` and seeded into the database. The backend checks permissions via the `PermissionsGuard` and `@RequirePermissions()` decorator.

JWT tokens include the user's permission list, validated on each request.

For integrating external applications (Next.js, NestJS, Spring Boot, .NET, etc.), see [External Integration Guide](INTEGRATION.md).

## Per-Resource Permissions

Future extension points for bucket/folder/object-level permissions are supported via the database schema. The `RolePermission` junction table can be extended with resource scoping.
