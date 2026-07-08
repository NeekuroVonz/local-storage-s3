import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number');

export const createUserSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roleId: z.string().uuid(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  projectIds: z.array(z.string().uuid()).default([]),
  projectRole: z.enum(['OWNER', 'MEMBER']).default('MEMBER'),
});

export const updateUserRoleSchema = z.object({
  roleId: z.string().uuid(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});

export const updateUserProjectsSchema = z.object({
  projectIds: z.array(z.string().uuid()),
  projectRole: z.enum(['OWNER', 'MEMBER']).default('MEMBER'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateUserProjectsInput = z.infer<typeof updateUserProjectsSchema>;
