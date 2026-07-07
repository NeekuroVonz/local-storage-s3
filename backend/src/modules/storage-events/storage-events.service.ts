import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ProjectQuotasService } from '../project-quotas/project-quotas.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import type { WebhookEvent } from '@storage/shared';

@Injectable()
export class StorageEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotas: ProjectQuotasService,
    private readonly webhooks: WebhooksService,
  ) {}

  async resolveProjectId(bucketName: string): Promise<string | null> {
    const link = await this.prisma.projectBucket.findUnique({
      where: { bucketName },
      select: { projectId: true },
    });
    return link?.projectId ?? null;
  }

  async beforeObjectCreate(
    bucket: string,
    byteSize: number,
    objectCount = 1,
  ): Promise<void> {
    const projectId = await this.resolveProjectId(bucket);
    if (!projectId) {
      return;
    }
    await this.quotas.assertCanStore(projectId, BigInt(byteSize), objectCount);
  }

  async afterObjectCreated(
    bucket: string,
    key: string,
    size: number,
    contentType?: string | null,
  ): Promise<void> {
    const projectId = await this.resolveProjectId(bucket);
    if (!projectId) {
      return;
    }

    await this.quotas.recordObjectCreated(projectId, BigInt(size), 1);
    await this.dispatch(projectId, 'object.created', { bucket, key, size, contentType });
  }

  async afterObjectsDeleted(
    bucket: string,
    objects: Array<{ key: string; size: number }>,
  ): Promise<void> {
    if (objects.length === 0) {
      return;
    }

    const projectId = await this.resolveProjectId(bucket);
    if (!projectId) {
      return;
    }

    const totalBytes = objects.reduce((sum, object) => sum + BigInt(object.size), 0n);
    await this.quotas.recordObjectsDeleted(projectId, totalBytes, objects.length);

    for (const object of objects) {
      await this.dispatch(projectId, 'object.deleted', {
        bucket,
        key: object.key,
        size: object.size,
      });
    }
  }

  private async dispatch(
    projectId: string,
    eventType: WebhookEvent,
    data: { bucket: string; key: string; size: number; contentType?: string | null },
  ): Promise<void> {
    await this.webhooks.dispatch(projectId, eventType, data);
  }
}
