import type { WebhookEvent } from '../schemas/webhook.schema';

export interface ProjectWebhookRecord {
  id: string;
  projectId: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
}

export interface ProjectWebhookCreated extends ProjectWebhookRecord {
  secret: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  webhookId: string;
  eventType: WebhookEvent;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  statusCode: number | null;
  attempts: number;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface ProjectQuotaStatus {
  maxStorageBytes: string | null;
  maxObjectCount: number | null;
  usage: {
    storageBytes: string;
    objectCount: number;
    updatedAt: string;
  };
  remaining: {
    storageBytes: string | null;
    objectCount: number | null;
  };
}
