import { z } from 'zod';
import { objectKeySchema } from './common.schema';

export const listObjectsSchema = z.object({
  prefix: z.string().default(''),
  delimiter: z.string().default('/'),
  continuationToken: z.string().optional(),
  maxKeys: z.coerce.number().int().min(1).max(1000).default(100),
});

export const createFolderSchema = z.object({
  prefix: z
    .string()
    .min(1)
    .max(1024)
    .refine((key) => !key.startsWith('/'), 'Folder path must not start with /')
    .refine((key) => key !== '/' && !key.includes('//'), 'Invalid folder path')
    .transform((key) => (key.endsWith('/') ? key : `${key}/`)),
});

export const renameObjectSchema = z.object({
  sourceKey: objectKeySchema,
  destinationKey: objectKeySchema,
});

export const copyObjectSchema = z.object({
  sourceKey: objectKeySchema,
  destinationKey: objectKeySchema,
  sourceBucket: z.string().optional(),
});

export const moveObjectSchema = z.object({
  sourceKey: objectKeySchema,
  destinationKey: objectKeySchema,
});

export const deleteObjectsSchema = z.object({
  keys: z.array(objectKeySchema).min(1).max(1000),
});

export const updateObjectMetadataSchema = z.object({
  metadata: z.record(z.string()),
  contentType: z.string().optional(),
  tags: z.record(z.string()).optional(),
});

export const initiateMultipartSchema = z.object({
  key: objectKeySchema,
  contentType: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export const uploadPartSchema = z.object({
  uploadId: z.string(),
  partNumber: z.coerce.number().int().min(1).max(10000),
});

export const completeMultipartSchema = z.object({
  uploadId: z.string(),
  parts: z.array(
    z.object({
      partNumber: z.number().int(),
      etag: z.string(),
    }),
  ),
});

export const presignedUrlSchema = z.object({
  key: objectKeySchema,
  operation: z.enum(['getObject', 'putObject']),
  expiresIn: z.coerce.number().int().min(60).max(604800).default(3600),
});

export type ListObjectsInput = z.infer<typeof listObjectsSchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type RenameObjectInput = z.infer<typeof renameObjectSchema>;
export type CopyObjectInput = z.infer<typeof copyObjectSchema>;
export type MoveObjectInput = z.infer<typeof moveObjectSchema>;
export type DeleteObjectsInput = z.infer<typeof deleteObjectsSchema>;
export type UpdateObjectMetadataInput = z.infer<typeof updateObjectMetadataSchema>;
export type InitiateMultipartInput = z.infer<typeof initiateMultipartSchema>;
export type CompleteMultipartInput = z.infer<typeof completeMultipartSchema>;
export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
