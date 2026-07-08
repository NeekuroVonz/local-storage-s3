import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    private readonly config: ConfigService,
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

    await this.syncStoredFilesAfterObjectDelete(
      bucket,
      objects.map((object) => object.key),
    );

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

  private async syncStoredFilesAfterObjectDelete(bucket: string, keys: string[]): Promise<void> {
    if (!keys.length) {
      return;
    }

    const softDeleteEnabled = this.config.get<boolean>('files.softDeleteEnabled') ?? true;
    const files = await this.prisma.storedFile.findMany({
      where: {
        bucketName: bucket,
        objectKey: { in: keys },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!files.length) {
      return;
    }

    const ids = files.map((file) => file.id);
    if (softDeleteEnabled) {
      await this.prisma.storedFile.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date() },
      });
      return;
    }

    await this.prisma.storedFile.deleteMany({
      where: { id: { in: ids } },
    });
  }

  private async dispatch(
    projectId: string,
    eventType: WebhookEvent,
    data: { bucket: string; key: string; size: number; contentType?: string | null },
  ): Promise<void> {
    await this.webhooks.dispatch(projectId, eventType, data);
  }
}
