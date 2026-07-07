import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { S3Service } from '../../infrastructure/storage/s3.service';
import type { UpdateProjectQuotasInput } from '@storage/shared';

@Injectable()
export class ProjectQuotasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async getStatus(projectId: string) {
    const project = await this.getProjectOrThrow(projectId);
    const usage = await this.getOrCreateUsage(projectId);

    const maxStorageBytes = project.quotaMaxStorageBytes;
    const maxObjectCount = project.quotaMaxObjectCount;

    return {
      success: true,
      data: {
        maxStorageBytes: maxStorageBytes?.toString() ?? null,
        maxObjectCount,
        usage: {
          storageBytes: usage.storageBytes.toString(),
          objectCount: usage.objectCount,
          updatedAt: usage.updatedAt.toISOString(),
        },
        remaining: {
          storageBytes:
            maxStorageBytes !== null
              ? (maxStorageBytes - usage.storageBytes).toString()
              : null,
          objectCount:
            maxObjectCount !== null ? maxObjectCount - usage.objectCount : null,
        },
      },
    };
  }

  async update(projectId: string, input: UpdateProjectQuotasInput) {
    await this.getProjectOrThrow(projectId);

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        quotaMaxStorageBytes:
          input.maxStorageBytes === undefined ? undefined : input.maxStorageBytes,
        quotaMaxObjectCount:
          input.maxObjectCount === undefined ? undefined : input.maxObjectCount,
      },
    });

    return this.getStatus(project.id);
  }

  async reconcile(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { buckets: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    let storageBytes = 0n;
    let objectCount = 0;

    for (const bucket of project.buckets) {
      const stats = await this.s3.getBucketStats(bucket.bucketName);
      storageBytes += BigInt(stats.totalSize);
      objectCount += stats.objectCount;
    }

    const usage = await this.prisma.projectUsage.upsert({
      where: { projectId },
      create: { projectId, storageBytes, objectCount },
      update: { storageBytes, objectCount },
    });

    return {
      success: true,
      data: {
        storageBytes: usage.storageBytes.toString(),
        objectCount: usage.objectCount,
        updatedAt: usage.updatedAt.toISOString(),
      },
      message: 'Usage reconciled from storage backend',
    };
  }

  async assertCanStore(
    projectId: string,
    additionalBytes: bigint,
    additionalObjects: number,
  ): Promise<void> {
    const project = await this.getProjectOrThrow(projectId);
    const usage = await this.getOrCreateUsage(projectId);

    if (
      project.quotaMaxStorageBytes !== null &&
      usage.storageBytes + additionalBytes > project.quotaMaxStorageBytes
    ) {
      throw new ForbiddenException('Project storage quota exceeded');
    }

    if (
      project.quotaMaxObjectCount !== null &&
      usage.objectCount + additionalObjects > project.quotaMaxObjectCount
    ) {
      throw new ForbiddenException('Project object count quota exceeded');
    }
  }

  async recordObjectCreated(
    projectId: string,
    byteSize: bigint,
    objectCount: number,
  ): Promise<void> {
    await this.getOrCreateUsage(projectId);
    await this.prisma.projectUsage.update({
      where: { projectId },
      data: {
        storageBytes: { increment: byteSize },
        objectCount: { increment: objectCount },
      },
    });
  }

  async recordObjectsDeleted(
    projectId: string,
    byteSize: bigint,
    objectCount: number,
  ): Promise<void> {
    const usage = await this.getOrCreateUsage(projectId);
    const nextBytes =
      usage.storageBytes > byteSize ? usage.storageBytes - byteSize : 0n;
    const nextCount =
      usage.objectCount > objectCount ? usage.objectCount - objectCount : 0;

    await this.prisma.projectUsage.update({
      where: { projectId },
      data: {
        storageBytes: nextBytes,
        objectCount: nextCount,
      },
    });
  }

  private async getOrCreateUsage(projectId: string) {
    return this.prisma.projectUsage.upsert({
      where: { projectId },
      create: { projectId },
      update: {},
    });
  }

  private async getProjectOrThrow(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
