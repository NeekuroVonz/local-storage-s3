import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { WEBHOOK_QUEUE } from '../../infrastructure/queue/queue.module';
import type { CreateProjectWebhookInput, WebhookEvent } from '@storage/shared';

interface WebhookPayloadData {
  bucket: string;
  key: string;
  size: number;
  contentType?: string | null;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  async list(projectId: string) {
    const webhooks = await this.prisma.projectWebhook.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: webhooks.map((webhook) => this.toRecord(webhook)),
    };
  }

  async create(projectId: string, input: CreateProjectWebhookInput, createdById: string) {
    await this.assertProjectExists(projectId);

    const secret = randomBytes(32).toString('hex');
    const webhook = await this.prisma.projectWebhook.create({
      data: {
        projectId,
        name: input.name,
        url: input.url,
        secretEnc: this.encryption.encrypt(secret),
        events: input.events,
        createdById,
      },
    });

    return {
      success: true,
      data: {
        ...this.toRecord(webhook),
        secret,
      },
      message: 'Webhook created — save the signing secret now',
    };
  }

  async remove(projectId: string, webhookId: string) {
    const webhook = await this.prisma.projectWebhook.findFirst({
      where: { id: webhookId, projectId },
    });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    await this.prisma.projectWebhook.delete({ where: { id: webhookId } });
    return { success: true, message: 'Webhook removed' };
  }

  async listDeliveries(projectId: string, webhookId: string, limit = 50) {
    const webhook = await this.prisma.projectWebhook.findFirst({
      where: { id: webhookId, projectId },
    });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      success: true,
      data: deliveries.map((delivery) => ({
        id: delivery.id,
        webhookId: delivery.webhookId,
        eventType: delivery.eventType,
        status: delivery.status,
        statusCode: delivery.statusCode,
        attempts: delivery.attempts,
        lastError: delivery.lastError,
        deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
      })),
    };
  }

  async dispatch(
    projectId: string,
    eventType: WebhookEvent,
    data: WebhookPayloadData,
  ): Promise<void> {
    const webhooks = await this.prisma.projectWebhook.findMany({
      where: {
        projectId,
        active: true,
        events: { has: eventType },
      },
    });

    if (webhooks.length === 0) {
      return;
    }

    const envelope = {
      id: randomUUID(),
      type: eventType,
      createdAt: new Date().toISOString(),
      projectId,
      data,
    };

    for (const webhook of webhooks) {
      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType,
          payload: envelope as unknown as Prisma.InputJsonValue,
        },
      });

      await this.webhookQueue.add(
        'deliver',
        { deliveryId: delivery.id },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
    }
  }

  signPayload(secret: string, timestamp: string, body: string): string {
    const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    return `sha256=${digest}`;
  }

  private toRecord(webhook: {
    id: string;
    projectId: string;
    name: string;
    url: string;
    events: string[];
    active: boolean;
    createdAt: Date;
  }) {
    return {
      id: webhook.id,
      projectId: webhook.projectId,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      createdAt: webhook.createdAt.toISOString(),
    };
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new BadRequestException('Project not found');
    }
  }
}
