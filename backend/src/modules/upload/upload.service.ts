import { Injectable, NotFoundException } from '@nestjs/common';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { BucketAccessService } from '../../common/services/bucket-access.service';
import { StorageEventsService } from '../storage-events/storage-events.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { InitiateMultipartInput, CompleteMultipartInput } from '@storage/shared';

const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

@Injectable()
export class UploadService {
  constructor(
    private readonly s3: S3Service,
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly bucketAccess: BucketAccessService,
    private readonly storageEvents: StorageEventsService,
  ) {}

  async uploadSimple(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string | undefined,
    user: AuthenticatedUser,
  ) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, key);
    await this.storageEvents.beforeObjectCreate(bucket, buffer.length);
    const result = await this.s3.putObject(bucket, key, buffer, contentType);

    await this.recordMetric('uploads');
    await this.activityService.log({
      userId: user.id,
      action: 'UPLOAD',
      resource: 'object',
      resourceId: `${bucket}/${key}`,
      metadata: { size: buffer.length, contentType },
    });
    await this.storageEvents.afterObjectCreated(bucket, key, buffer.length, contentType);

    return { success: true, data: { etag: result.etag, key } };
  }

  async initiateMultipart(bucket: string, input: InitiateMultipartInput, user: AuthenticatedUser) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, input.key);
    const result = await this.s3.initiateMultipartUpload(
      bucket,
      input.key,
      input.contentType,
      input.metadata,
    );

    await this.prisma.uploadJob.create({
      data: {
        userId: user.id,
        bucketName: bucket,
        objectKey: input.key,
        uploadId: result.uploadId,
        status: 'in_progress',
        totalSize: BigInt(0),
        contentType: input.contentType,
        metadata: input.metadata ?? {},
      },
    });

    return { success: true, data: result };
  }

  async uploadPart(
    bucket: string,
    key: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer,
    user: AuthenticatedUser,
  ) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, key);
    const result = await this.s3.uploadPart(bucket, key, uploadId, partNumber, buffer);

    const job = await this.prisma.uploadJob.findFirst({
      where: { uploadId, bucketName: bucket, objectKey: key },
    });

    if (job) {
      await this.prisma.uploadJob.update({
        where: { id: job.id },
        data: { uploadedSize: { increment: BigInt(buffer.length) } },
      });
    }

    return { success: true, data: result };
  }

  async completeMultipart(
    bucket: string,
    key: string,
    input: CompleteMultipartInput,
    user: AuthenticatedUser,
  ) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, key);

    const job = await this.prisma.uploadJob.findFirst({
      where: { uploadId: input.uploadId, bucketName: bucket, objectKey: key },
    });
    const uploadedSize = Number(job?.uploadedSize ?? 0n);
    await this.storageEvents.beforeObjectCreate(bucket, uploadedSize);

    const result = await this.s3.completeMultipartUpload(
      bucket,
      key,
      input.uploadId,
      input.parts,
    );

    await this.prisma.uploadJob.updateMany({
      where: { uploadId: input.uploadId },
      data: { status: 'completed' },
    });

    const metadata = await this.s3.getObjectMetadata(bucket, key);
    const size = metadata.size || uploadedSize;

    await this.recordMetric('uploads');
    await this.activityService.log({
      userId: user.id,
      action: 'UPLOAD',
      resource: 'object',
      resourceId: `${bucket}/${key}`,
      metadata: { multipart: true, parts: input.parts.length },
    });
    await this.storageEvents.afterObjectCreated(bucket, key, size, metadata.contentType);

    return { success: true, data: result };
  }

  async abortMultipart(bucket: string, key: string, uploadId: string, user: AuthenticatedUser) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, key);
    await this.s3.abortMultipartUpload(bucket, key, uploadId);
    await this.prisma.uploadJob.updateMany({
      where: { uploadId },
      data: { status: 'aborted' },
    });
    return { success: true, message: 'Upload aborted' };
  }

  async listParts(bucket: string, key: string, uploadId: string, user: AuthenticatedUser) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, key);
    const parts = await this.s3.listParts(bucket, key, uploadId);
    return { success: true, data: parts };
  }

  getMultipartThreshold(): number {
    return MULTIPART_THRESHOLD;
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
