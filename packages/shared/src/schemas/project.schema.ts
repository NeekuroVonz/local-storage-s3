import { z } from 'zod';
import { bucketNameSchema } from './common.schema';

const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

const orgNameSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Name must be lowercase alphanumeric with hyphens');

export const createOrganizationSchema = z.object({
  name: orgNameSchema,
  displayName: z.string().min(1).max(128),
  description: z.string().max(512).optional(),
});

export const updateOrganizationSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  description: z.string().max(512).optional(),
});

export const createProjectSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(64),
  slug: slugSchema,
  description: z.string().max(512).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  description: z.string().max(512).optional(),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['OWNER', 'MEMBER']).default('MEMBER'),
});

export const createProjectBucketSchema = z.object({
  name: bucketNameSchema,
  versioning: z.boolean().default(false),
  publicAccess: z.boolean().default(false),
  tags: z.record(z.string()).optional(),
  isDefault: z.boolean().default(true),
});

export const linkProjectBucketSchema = z.object({
  bucketName: bucketNameSchema,
  isDefault: z.boolean().default(false),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type CreateProjectBucketInput = z.infer<typeof createProjectBucketSchema>;
export type LinkProjectBucketInput = z.infer<typeof linkProjectBucketSchema>;
