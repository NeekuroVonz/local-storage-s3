import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GrantSubjectType } from '@prisma/client';
import type { CreateBucketGrantInput } from '@storage/shared';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class BucketGrantsService {
  constructor(private readonly prisma: PrismaService) {}

  normalizePrefix(prefix: string): string {
    const trimmed = prefix.trim();
    if (!trimmed) {
      return '';
    }
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  async list(projectId: string, bucketName?: string) {
    const projectBuckets = await this.getProjectBucketNames(projectId);
    const bucketFilter = bucketName
      ? projectBuckets.filter((name) => name === bucketName)
      : projectBuckets;

    if (bucketName && bucketFilter.length === 0) {
      throw new NotFoundException(`Bucket "${bucketName}" is not linked to this project`);
    }

    const grants = await this.prisma.bucketAccessGrant.findMany({
      where: { bucketName: { in: bucketFilter } },
      orderBy: [{ bucketName: 'asc' }, { createdAt: 'desc' }],
    });

    const userIds = grants
      .filter((grant) => grant.subjectType === GrantSubjectType.USER)
      .map((grant) => grant.subjectId);
    const apiKeyIds = grants
      .filter((grant) => grant.subjectType === GrantSubjectType.API_KEY)
      .map((grant) => grant.subjectId);

    const [users, apiKeys] = await Promise.all([
      userIds.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
      apiKeyIds.length > 0
        ? this.prisma.apiKey.findMany({
            where: { id: { in: apiKeyIds }, projectId },
            select: { id: true, name: true, keyPrefix: true },
          })
        : Promise.resolve([]),
    ]);

    const userLabels = new Map(
      users.map((user) => [
        user.id,
        `${user.firstName} ${user.lastName}`.trim() || user.email,
      ]),
    );
    const apiKeyLabels = new Map(
      apiKeys.map((key) => [key.id, `${key.name} (${key.keyPrefix})`]),
    );

    return {
      success: true,
      data: grants.map((grant) => ({
        id: grant.id,
        bucketName: grant.bucketName,
        subjectType: grant.subjectType,
        subjectId: grant.subjectId,
        permissions: grant.permissions,
        prefix: grant.prefix,
        createdAt: grant.createdAt.toISOString(),
        subjectLabel:
          grant.subjectType === GrantSubjectType.USER
            ? userLabels.get(grant.subjectId) ?? grant.subjectId
            : apiKeyLabels.get(grant.subjectId) ?? grant.subjectId,
      })),
    };
  }

  async create(projectId: string, input: CreateBucketGrantInput, createdById: string) {
    const projectBuckets = await this.getProjectBucketNames(projectId);
    if (!projectBuckets.includes(input.bucketName)) {
      throw new BadRequestException(
        `Bucket "${input.bucketName}" is not linked to this project`,
      );
    }

    await this.assertSubjectBelongsToProject(projectId, input.subjectType, input.subjectId);

    const prefix = this.normalizePrefix(input.prefix ?? '');

    const grant = await this.prisma.bucketAccessGrant.create({
      data: {
        bucketName: input.bucketName,
        subjectType: input.subjectType as GrantSubjectType,
        subjectId: input.subjectId,
        permissions: input.permissions,
        prefix,
        createdById,
      },
    });

    return {
      success: true,
      data: {
        id: grant.id,
        bucketName: grant.bucketName,
        subjectType: grant.subjectType,
        subjectId: grant.subjectId,
        permissions: grant.permissions,
        prefix: grant.prefix,
        createdAt: grant.createdAt.toISOString(),
      },
    };
  }

  async remove(projectId: string, grantId: string) {
    const grant = await this.prisma.bucketAccessGrant.findUnique({ where: { id: grantId } });
    if (!grant) {
      throw new NotFoundException('Grant not found');
    }

    const projectBuckets = await this.getProjectBucketNames(projectId);
    if (!projectBuckets.includes(grant.bucketName)) {
      throw new NotFoundException('Grant not found');
    }

    await this.prisma.bucketAccessGrant.delete({ where: { id: grantId } });
    return { success: true, message: 'Grant removed' };
  }

  private async getProjectBucketNames(projectId: string): Promise<string[]> {
    const buckets = await this.prisma.projectBucket.findMany({
      where: { projectId },
      select: { bucketName: true },
    });
    return buckets.map((bucket) => bucket.bucketName);
  }

  private async assertSubjectBelongsToProject(
    projectId: string,
    subjectType: string,
    subjectId: string,
  ): Promise<void> {
    if (subjectType === 'USER') {
      const user = await this.prisma.user.findUnique({ where: { id: subjectId } });
      if (!user) {
        throw new BadRequestException('User not found');
      }
      return;
    }

    if (subjectType === 'API_KEY') {
      const apiKey = await this.prisma.apiKey.findFirst({
        where: { id: subjectId, projectId, revokedAt: null },
      });
      if (!apiKey) {
        throw new BadRequestException('API key not found in this project');
      }
      return;
    }

    throw new BadRequestException('Invalid subject type');
  }
}
