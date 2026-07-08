import { z } from 'zod';
import { bucketNameSchema } from './common.schema';

const folderCodeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'Invalid folder code');

export const createStorageFolderSchema = z.object({
  code: folderCodeSchema,
  name: z.string().min(1).max(128),
  parentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  bucketName: bucketNameSchema,
  prefix: z.string().max(1024).optional(),
});

export const updateStorageFolderSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  code: folderCodeSchema.optional(),
});

export const searchStorageFoldersSchema = z.object({
  q: z.string().min(1).max(128).optional(),
  projectId: z.string().uuid().optional(),
  rootsOnly: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => value === true || value === 'true' || value === '1')
    .default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateStorageFolderInput = z.infer<typeof createStorageFolderSchema>;
export type UpdateStorageFolderInput = z.infer<typeof updateStorageFolderSchema>;
export type SearchStorageFoldersInput = z.infer<typeof searchStorageFoldersSchema>;
