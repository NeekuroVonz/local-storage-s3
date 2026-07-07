import { z } from 'zod';

export const WEBHOOK_EVENTS = ['object.created', 'object.deleted'] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const createProjectWebhookSchema = z.object({
  name: z.string().min(1).max(128),
  url: z.string().url().max(2048),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1)
    .refine((events) => new Set(events).size === events.length, {
      message: 'Duplicate events are not allowed',
    }),
});

export const updateProjectQuotasSchema = z.object({
  maxStorageBytes: z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      if (value === null) {
        return null;
      }
      return BigInt(value);
    }),
  maxObjectCount: z.number().int().nonnegative().nullable().optional(),
});

export type CreateProjectWebhookInput = z.infer<typeof createProjectWebhookSchema>;
export type UpdateProjectQuotasInput = z.infer<typeof updateProjectQuotasSchema>;
