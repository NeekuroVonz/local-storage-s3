import { z } from 'zod';
import { bucketNameSchema } from './common.schema';

export const createBucketSchema = z.object({
  name: bucketNameSchema,
  region: z.string().optional(),
  tags: z.record(z.string()).optional(),
  versioning: z.boolean().default(false),
  publicAccess: z.boolean().default(false),
});

export const updateBucketSchema = z.object({
  tags: z.record(z.string()).optional(),
  versioning: z.boolean().optional(),
  publicAccess: z.boolean().optional(),
  cors: z
    .array(
      z.object({
        allowedOrigins: z.array(z.string()),
        allowedMethods: z.array(z.string()),
        allowedHeaders: z.array(z.string()).optional(),
        exposeHeaders: z.array(z.string()).optional(),
        maxAgeSeconds: z.number().int().optional(),
      }),
    )
    .optional(),
});

export const renameBucketSchema = z.object({
  newName: bucketNameSchema,
});

export type CreateBucketInput = z.infer<typeof createBucketSchema>;
export type UpdateBucketInput = z.infer<typeof updateBucketSchema>;
export type RenameBucketInput = z.infer<typeof renameBucketSchema>;
