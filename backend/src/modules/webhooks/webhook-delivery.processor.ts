import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhookDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { WEBHOOK_QUEUE } from '../../infrastructure/queue/queue.module';
import { WebhooksService } from './webhooks.service';

@Processor(WEBHOOK_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly webhooksService: WebhooksService,
  ) {
    super();
  }

  async process(job: Job<{ deliveryId: string }>): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: job.data.deliveryId },
      include: { webhook: true },
    });

    if (!delivery || !delivery.webhook.active) {
      return;
    }

    const body = JSON.stringify(delivery.payload);
    const timestamp = new Date().toISOString();
    const secret = this.encryption.decrypt(delivery.webhook.secretEnc);
    const signature = this.webhooksService.signPayload(secret, timestamp, body);

    try {
      const response = await fetch(delivery.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': delivery.id,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.eventType,
        },
        body,
        signal: AbortSignal.timeout(15000),
      });

      const responseBody = await response.text();
      const success = response.ok;

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: success ? WebhookDeliveryStatus.SUCCESS : WebhookDeliveryStatus.FAILED,
          statusCode: response.status,
          responseBody: responseBody.slice(0, 4096),
          attempts: { increment: 1 },
          lastError: success ? null : `HTTP ${response.status}`,
          deliveredAt: success ? new Date() : null,
        },
      });

      if (!success) {
        throw new Error(`Webhook delivery failed with status ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Webhook delivery failed';
      this.logger.warn(`Webhook ${delivery.id} failed: ${message}`);

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WebhookDeliveryStatus.FAILED,
          attempts: { increment: 1 },
          lastError: message.slice(0, 1024),
        },
      });

      throw error;
    }
  }
}
