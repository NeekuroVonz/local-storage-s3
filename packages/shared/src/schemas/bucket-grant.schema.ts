import { z } from 'zod';
import { API_KEY_PERMISSIONS } from './api-key.schema';

export const GRANT_SUBJECT_TYPES = ['USER', 'API_KEY'] as const;

export type GrantSubjectType = (typeof GRANT_SUBJECT_TYPES)[number];

export const createBucketGrantSchema = z.object({
  bucketName: z.string().min(1).max(255),
  subjectType: z.enum(GRANT_SUBJECT_TYPES),
  subjectId: z.string().uuid(),
  permissions: z
    .array(z.string())
    .min(1)
    .refine(
      (perms) => perms.every((p) => (API_KEY_PERMISSIONS as readonly string[]).includes(p)),
      { message: `Permissions must be one of: ${API_KEY_PERMISSIONS.join(', ')}` },
    ),
  prefix: z.string().max(1024).optional().default(''),
});

export type CreateBucketGrantInput = z.infer<typeof createBucketGrantSchema>;
