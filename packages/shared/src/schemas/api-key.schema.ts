import { z } from 'zod';
import { Permission } from '../constants/permissions';

export const API_KEY_PERMISSIONS = [
  Permission.BUCKETS_READ,
  Permission.OBJECTS_READ,
  Permission.OBJECTS_WRITE,
  Permission.OBJECTS_DELETE,
  Permission.SHARES_READ,
  Permission.SHARES_WRITE,
] as const;

export type ApiKeyPermission = (typeof API_KEY_PERMISSIONS)[number];

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(128),
  permissions: z
    .array(z.string())
    .min(1)
    .refine(
      (perms) => perms.every((p) => (API_KEY_PERMISSIONS as readonly string[]).includes(p)),
      { message: `Permissions must be one of: ${API_KEY_PERMISSIONS.join(', ')}` },
    ),
  bucketNames: z.array(z.string()).default([]),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
  environment: z.enum(['live', 'test']).default('live'),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
