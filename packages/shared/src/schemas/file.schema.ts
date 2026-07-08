import { z } from 'zod';

export const updateStoredFileSchema = z.object({
  description: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(64)).max(50).optional(),
  module: z.string().min(1).max(128).optional(),
  customMetadata: z.record(z.unknown()).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

export const deleteStoredFilesSchema = z
  .object({
    ids: z.array(z.string().uuid()).max(1000).optional(),
    paths: z.array(z.string().min(1).max(1024)).max(1000).optional(),
    bucket: z.string().min(3).max(63).optional(),
    hard: z.boolean().optional().default(false),
  })
  .refine((value) => (value.ids?.length ?? 0) > 0 || (value.paths?.length ?? 0) > 0, {
    message: 'Provide at least one id or path',
  });

export const searchStoredFilesSchema = z.object({
  name: z.string().max(512).optional(),
  module: z.string().max(128).optional(),
  ownerId: z.string().uuid().optional(),
  extension: z.string().max(32).optional(),
  minSize: z.coerce.number().int().min(0).optional(),
  maxSize: z.coerce.number().int().min(0).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  folderId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  bucket: z.string().min(3).max(63).optional(),
  // Query strings: Boolean("false") === true with z.coerce.boolean — parse explicitly.
  trashed: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional()
    .transform((value) => value === true || value === 'true' || value === '1')
    .default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UpdateStoredFileInput = z.infer<typeof updateStoredFileSchema>;
export type DeleteStoredFilesInput = z.infer<typeof deleteStoredFilesSchema>;
export type SearchStoredFilesInput = z.infer<typeof searchStoredFilesSchema>;
