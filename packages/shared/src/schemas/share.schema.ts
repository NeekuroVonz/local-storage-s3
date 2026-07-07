import { z } from 'zod';
import { objectKeySchema } from './common.schema';

export const createShareSchema = z.object({
  bucketName: z.string(),
  objectKey: objectKeySchema,
  expiresAt: z.coerce.date().optional(),
  password: z.string().min(4).optional(),
  maxDownloads: z.number().int().min(1).optional(),
  allowedIps: z.array(z.string()).optional(),
  permission: z.enum(['view', 'download']).default('download'),
});

export type CreateShareInput = z.infer<typeof createShareSchema>;
