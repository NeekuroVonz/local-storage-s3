import { Injectable, NotFoundException } from '@nestjs/common';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { ActivityService } from '../activity/activity.service';
import { BucketAccessService } from '../../common/services/bucket-access.service';
import { StorageEventsService } from '../storage-events/storage-events.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type {
  ListObjectsInput,
  CreateFolderInput,
  RenameObjectInput,
  CopyObjectInput,
  MoveObjectInput,
  DeleteObjectsInput,
  PresignedUrlInput,
} from '@storage/shared';

@Injectable()
export class ObjectsService {
  constructor(
    private readonly s3: S3Service,
    private readonly activityService: ActivityService,
    private readonly bucketAccess: BucketAccessService,
    private readonly storageEvents: StorageEventsService,
  ) {}

  async list(bucket: string, query: ListObjectsInput, user: AuthenticatedUser) {
    const exists = await this.s3.bucketExists(bucket);
    if (!exists) {
      throw new NotFoundException(`Bucket "${bucket}" not found`);
    }

    await this.bucketAccess.assertListPrefixAccess(user, bucket, query.prefix ?? '');

    const result = await this.s3.listObjects(
      bucket,
      query.prefix,
      query.delimiter,
      query.continuationToken,
      query.maxKeys,
    );

    result.objects = await this.bucketAccess.filterObjectsByPrefix(user, bucket, result.objects);
    if (result.commonPrefixes) {
      result.commonPrefixes = await this.bucketAccess.filterCommonPrefixes(
        user,
        bucket,
        result.commonPrefixes,
      );
    }

    return { success: true, data: result };
  }

  async getMetadata(bucket: string, key: string, user: AuthenticatedUser) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, key);
    const metadata = await this.s3.getObjectMetadata(bucket, key);
    return { success: true, data: metadata };
  }

  async createFolder(bucket: string, input: CreateFolderInput, user: AuthenticatedUser) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, input.prefix);
    await this.storageEvents.beforeObjectCreate(bucket, 0);
    await this.s3.createFolder(bucket, input.prefix);

    await this.activityService.log({
      userId: user.id,
      action: 'UPLOAD',
      resource: 'object',
      resourceId: `${bucket}/${input.prefix}`,
      metadata: { type: 'folder' },
    });
    await this.storageEvents.afterObjectCreated(bucket, input.prefix, 0, 'application/x-directory');

    return { success: true, message: 'Folder created' };
  }

  async rename(bucket: string, input: RenameObjectInput, user: AuthenticatedUser) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, input.sourceKey);
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, input.destinationKey);
    await this.s3.copyObject(bucket, input.sourceKey, bucket, input.destinationKey);
    await this.s3.deleteObject(bucket, input.sourceKey);

    await this.activityService.log({
      userId: user.id,
      action: 'RENAME',
      resource: 'object',
      metadata: { source: input.sourceKey, destination: input.destinationKey },
    });

    return { success: true, message: 'Object renamed' };
  }

  async copy(bucket: string, input: CopyObjectInput, user: AuthenticatedUser) {
    const sourceBucket = input.sourceBucket ?? bucket;
    await this.bucketAccess.assertObjectKeyAccess(user, sourceBucket, input.sourceKey);
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, input.destinationKey);

    const sourceMetadata = await this.s3.getObjectMetadata(sourceBucket, input.sourceKey);
    await this.storageEvents.beforeObjectCreate(bucket, sourceMetadata.size);

    const result = await this.s3.copyObject(sourceBucket, input.sourceKey, bucket, input.destinationKey);

    await this.activityService.log({
      userId: user.id,
      action: 'COPY',
      resource: 'object',
      metadata: { source: input.sourceKey, destination: input.destinationKey },
    });
    await this.storageEvents.afterObjectCreated(
      bucket,
      input.destinationKey,
      sourceMetadata.size,
      sourceMetadata.contentType,
    );

    return { success: true, data: result };
  }

  async move(bucket: string, input: MoveObjectInput, user: AuthenticatedUser) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, input.sourceKey);
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, input.destinationKey);
    await this.s3.copyObject(bucket, input.sourceKey, bucket, input.destinationKey);
    await this.s3.deleteObject(bucket, input.sourceKey);

    await this.activityService.log({
      userId: user.id,
      action: 'MOVE',
      resource: 'object',
      metadata: { source: input.sourceKey, destination: input.destinationKey },
    });

    return { success: true, message: 'Object moved' };
  }

  async deleteMany(bucket: string, input: DeleteObjectsInput, user: AuthenticatedUser) {
    for (const key of input.keys) {
      await this.bucketAccess.assertObjectKeyAccess(user, bucket, key);
    }

    const deletedObjects = await Promise.all(
      input.keys.map(async (key) => {
        try {
          const metadata = await this.s3.getObjectMetadata(bucket, key);
          return { key, size: metadata.size };
        } catch {
          return { key, size: 0 };
        }
      }),
    );

    await this.s3.deleteObjects(bucket, input.keys);

    await this.activityService.log({
      userId: user.id,
      action: 'DELETE',
      resource: 'object',
      metadata: { keys: input.keys, count: input.keys.length },
    });
    await this.storageEvents.afterObjectsDeleted(bucket, deletedObjects);

    return { success: true, message: `${input.keys.length} object(s) deleted` };
  }

  async getPresignedUrl(bucket: string, input: PresignedUrlInput, user: AuthenticatedUser) {
    await this.bucketAccess.assertObjectKeyAccess(user, bucket, input.key);
    const result = await this.s3.getPresignedUrl(bucket, input.key, input.operation, input.expiresIn);
    return { success: true, data: result };
  }
}
