import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { BucketAccessService } from '../../common/services/bucket-access.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';

@Injectable()
export class DownloadService {
  constructor(
    private readonly s3: S3Service,
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly bucketAccess: BucketAccessService,
  ) {}

  async downloadObject(bucket: string, key: string, user: AuthenticatedUser) {
    const exists = await this.s3.bucketExists(bucket);
    if (!exists) {
      throw new NotFoundException(`Bucket "${bucket}" not found`);
    }

    await this.bucketAccess.assertObjectKeyAccess(user, bucket, key);
    const { stream, contentType, contentLength } = await this.s3.getObjectStream(bucket, key);

    await this.recordMetric('downloads');
    await this.activityService.log({
      userId: user.id,
      action: 'DOWNLOAD',
      resource: 'object',
      resourceId: `${bucket}/${key}`,
      metadata: { size: contentLength },
    });

    return new StreamableFile(stream, {
      type: contentType ?? 'application/octet-stream',
      disposition: `attachment; filename="${key.split('/').pop()}"`,
      length: contentLength,
    });
  }

  async downloadAsZip(bucket: string, keys: string[], user: AuthenticatedUser): Promise<StreamableFile> {
    for (const key of keys) {
      await this.bucketAccess.assertObjectKeyAccess(user, bucket, key);
    }

    const passThrough = new PassThrough();
    const archive = archiver.create('zip', { zlib: { level: 5 } });
    archive.pipe(passThrough);

    for (const key of keys) {
      const { stream } = await this.s3.getObjectStream(bucket, key);
      const fileName = key.split('/').pop() ?? key;
      archive.append(stream, { name: fileName });
    }

    void archive.finalize();

    await this.recordMetric('downloads');
    await this.activityService.log({
      userId: user.id,
      action: 'DOWNLOAD',
      resource: 'object',
      metadata: { type: 'zip', keys, count: keys.length },
    });

    return new StreamableFile(passThrough, {
      type: 'application/zip',
      disposition: `attachment; filename="${bucket}-download.zip"`,
    });
  }

  private async recordMetric(metric: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.dailyMetric.upsert({
      where: { date_metric: { date: today, metric } },
      create: { date: today, metric, value: BigInt(1) },
      update: { value: { increment: BigInt(1) } },
    });
  }
}
