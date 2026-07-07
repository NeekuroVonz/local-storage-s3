import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { BucketAccessService } from '../../common/services/bucket-access.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { CreateBucketInput, UpdateBucketInput } from '@storage/shared';

@Injectable()
export class BucketsService {
  constructor(
    private readonly s3: S3Service,
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly bucketAccess: BucketAccessService,
  ) {}

  async findAll(user: AuthenticatedUser, search?: string) {
    const buckets = await this.s3.listBuckets();
    const filteredBuckets = await this.bucketAccess.filterBuckets(user, buckets);
    const metadataRecords = await this.prisma.bucketMetadata.findMany();
    const metadataMap = new Map(metadataRecords.map((m) => [m.name, m]));

    let result = filteredBuckets.map((bucket) => {
      const meta = metadataMap.get(bucket.name);
      return {
        ...bucket,
        displayName: meta?.displayName ?? bucket.name,
        description: meta?.description ?? null,
        versioning: meta?.versioning ?? bucket.versioning,
        publicAccess: meta?.publicAccess ?? bucket.publicAccess,
        tags: (meta?.tags as Record<string, string>) ?? bucket.tags,
      };
    });

    if (search) {
      const lower = search.toLowerCase();
      result = result.filter((b) => b.name.toLowerCase().includes(lower));
    }

    return { success: true, data: result };
  }

  async findOne(name: string, user: AuthenticatedUser) {
    await this.bucketAccess.assertBucketAccess(user, name);

    const exists = await this.s3.bucketExists(name);
    if (!exists) {
      throw new NotFoundException(`Bucket "${name}" not found`);
    }

    const stats = await this.s3.getBucketStats(name);
    const meta = await this.prisma.bucketMetadata.findUnique({ where: { name } });
    const tags = await this.s3.getBucketTags(name);
    const versioning = await this.s3.getBucketVersioning(name);
    const cors = await this.s3.getBucketCors(name);

    return {
      success: true,
      data: {
        name,
        displayName: meta?.displayName ?? name,
        description: meta?.description ?? null,
        objectCount: stats.objectCount,
        size: stats.totalSize,
        versioning,
        publicAccess: meta?.publicAccess ?? false,
        tags: Object.keys(tags).length > 0 ? tags : (meta?.tags as Record<string, string>) ?? {},
        cors,
        lifecycle: meta?.lifecycle ?? null,
        createdAt: meta?.createdAt?.toISOString() ?? null,
      },
    };
  }

  async create(input: CreateBucketInput, userId: string, user: AuthenticatedUser) {
    if (!this.bucketAccess.hasGlobalBucketAccess(user)) {
      throw new ForbiddenException(
        'Project-scoped users must create buckets via POST /projects/:projectId/buckets',
      );
    }

    return this.createInternal(input, userId);
  }

  async createForProject(input: CreateBucketInput, userId: string, projectId: string) {
    const result = await this.createInternal(input, userId);
    await this.prisma.bucketMetadata.update({
      where: { name: input.name },
      data: { projectId },
    });
    return result;
  }

  private async createInternal(input: CreateBucketInput, userId: string) {
    const exists = await this.s3.bucketExists(input.name);
    if (exists) {
      throw new ConflictException(`Bucket "${input.name}" already exists`);
    }

    await this.s3.createBucket(input.name);

    if (input.versioning) {
      await this.s3.setBucketVersioning(input.name, true);
    }

    if (input.tags && Object.keys(input.tags).length > 0) {
      await this.s3.setBucketTags(input.name, input.tags);
    }

    await this.prisma.bucketMetadata.create({
      data: {
        name: input.name,
        tags: input.tags ?? {},
        versioning: input.versioning,
        publicAccess: input.publicAccess,
        createdById: userId,
      },
    });

    await this.activityService.log({
      userId,
      action: 'BUCKET_CREATE',
      resource: 'bucket',
      resourceId: input.name,
      metadata: { name: input.name },
    });

    return { success: true, data: { name: input.name }, message: 'Bucket created' };
  }

  async update(name: string, input: UpdateBucketInput, userId: string, user: AuthenticatedUser) {
    await this.bucketAccess.assertBucketAccess(user, name);

    const exists = await this.s3.bucketExists(name);
    if (!exists) {
      throw new NotFoundException(`Bucket "${name}" not found`);
    }

    if (input.versioning !== undefined) {
      await this.s3.setBucketVersioning(name, input.versioning);
    }

    if (input.tags) {
      await this.s3.setBucketTags(name, input.tags);
    }

    if (input.cors) {
      await this.s3.setBucketCors(name, input.cors);
    }

    await this.prisma.bucketMetadata.upsert({
      where: { name },
      create: {
        name,
        tags: input.tags ?? {},
        versioning: input.versioning ?? false,
        publicAccess: input.publicAccess ?? false,
        cors: input.cors as Prisma.InputJsonValue,
        createdById: userId,
      },
      update: {
        tags: input.tags as Prisma.InputJsonValue,
        versioning: input.versioning,
        publicAccess: input.publicAccess,
        cors: input.cors as Prisma.InputJsonValue,
      },
    });

    await this.activityService.log({
      userId,
      action: 'BUCKET_UPDATE',
      resource: 'bucket',
      resourceId: name,
    });

    return { success: true, message: 'Bucket updated' };
  }

  async remove(name: string, userId: string, user: AuthenticatedUser) {
    await this.bucketAccess.assertBucketAccess(user, name);

    const exists = await this.s3.bucketExists(name);
    if (!exists) {
      throw new NotFoundException(`Bucket "${name}" not found`);
    }

    const stats = await this.s3.getBucketStats(name);
    if (stats.objectCount > 0) {
      throw new ConflictException('Bucket must be empty before deletion');
    }

    await this.s3.deleteBucket(name);
    await this.prisma.projectBucket.deleteMany({ where: { bucketName: name } });
    await this.prisma.bucketMetadata.deleteMany({ where: { name } });

    await this.activityService.log({
      userId,
      action: 'BUCKET_DELETE',
      resource: 'bucket',
      resourceId: name,
    });

    return { success: true, message: 'Bucket deleted' };
  }
}
