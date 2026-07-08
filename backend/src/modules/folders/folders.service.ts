import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Permission } from '@storage/shared';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BucketAccessService } from '../../common/services/bucket-access.service';
import { S3Service } from '../../infrastructure/storage/s3.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type {
  CreateStorageFolderInput,
  SearchStorageFoldersInput,
  StorageFolderRecord,
  UpdateStorageFolderInput,
} from '@storage/shared';

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bucketAccess: BucketAccessService,
    private readonly s3: S3Service,
  ) {}

  async create(input: CreateStorageFolderInput, user: AuthenticatedUser) {
    await this.bucketAccess.assertBucketAccess(user, input.bucketName);
    await this.assertCanBindProject(user, input.projectId);

    let parentPrefix = '';
    if (input.parentId) {
      const parent = await this.prisma.storageFolder.findUnique({ where: { id: input.parentId } });
      if (!parent) {
        throw new NotFoundException('Parent folder not found');
      }
      if (parent.bucketName !== input.bucketName) {
        throw new BadRequestException('Parent folder is in a different bucket');
      }
      if (input.projectId && parent.projectId && input.projectId !== parent.projectId) {
        throw new BadRequestException('Parent folder belongs to another project');
      }
      parentPrefix = parent.prefix.replace(/\/+$/, '');
    }

    const exists = await this.prisma.storageFolder.findFirst({
      where: {
        code: input.code,
        projectId: input.projectId ?? null,
      },
    });
    if (exists) {
      throw new ConflictException(`Folder code "${input.code}" already exists`);
    }

    const segment = (input.prefix?.trim() || input.code).replace(/^\/+|\/+$/g, '');
    const prefix = [parentPrefix, segment].filter(Boolean).join('/') + '/';

    await this.s3.createFolder(input.bucketName, prefix);

    const folder = await this.prisma.storageFolder.create({
      data: {
        code: input.code,
        name: input.name,
        parentId: input.parentId,
        projectId: input.projectId,
        bucketName: input.bucketName,
        prefix,
        createdById: user.id,
      },
    });

    return { success: true, data: await this.toRecord(folder) };
  }

  async list(query: SearchStorageFoldersInput, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const allowedBuckets = await this.bucketAccess.getAccessibleBucketNames(user);

    const where = {
      projectId: query.projectId,
      parentId: query.rootsOnly ? null : undefined,
      bucketName: allowedBuckets ? { in: allowedBuckets } : undefined,
      OR: query.q
        ? [
            { code: { contains: query.q, mode: 'insensitive' as const } },
            { name: { contains: query.q, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [total, rows] = await Promise.all([
      this.prisma.storageFolder.count({ where }),
      this.prisma.storageFolder.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: await Promise.all(rows.map((row) => this.toRecord(row))),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async listBindings(projectId: string, user: AuthenticatedUser) {
    return this.list({ projectId, rootsOnly: true, page: 1, limit: 100 }, user);
  }

  async search(query: SearchStorageFoldersInput, user: AuthenticatedUser) {
    if (!query.q?.trim()) {
      throw new BadRequestException('q is required for folder search');
    }
    return this.list({ ...query, rootsOnly: false }, user);
  }

  async update(id: string, input: UpdateStorageFolderInput, user: AuthenticatedUser) {
    const folder = await this.getFolderOrThrow(id);
    await this.bucketAccess.assertBucketAccess(user, folder.bucketName);

    if (input.code && input.code !== folder.code) {
      const clash = await this.prisma.storageFolder.findFirst({
        where: {
          code: input.code,
          projectId: folder.projectId,
          NOT: { id: folder.id },
        },
      });
      if (clash) {
        throw new ConflictException(`Folder code "${input.code}" already exists`);
      }
    }

    const updated = await this.prisma.storageFolder.update({
      where: { id },
      data: {
        name: input.name,
        code: input.code,
      },
    });

    return { success: true, data: await this.toRecord(updated) };
  }

  async remove(id: string, user: AuthenticatedUser) {
    const folder = await this.getFolderOrThrow(id);
    await this.bucketAccess.assertBucketAccess(user, folder.bucketName);
    await this.assertNotInUse(folder.id);

    const markerKey = folder.prefix.endsWith('/') ? folder.prefix : `${folder.prefix}/`;
    try {
      await this.s3.deleteObjects(folder.bucketName, [markerKey]);
    } catch {
      // Marker may already be absent.
    }

    await this.prisma.storageFolder.delete({ where: { id } });
    return { success: true, message: 'Folder deleted' };
  }

  private async assertCanBindProject(user: AuthenticatedUser, projectId?: string) {
    if (!projectId) {
      return;
    }

    if (
      user.role === 'admin' ||
      user.permissions.includes(Permission.PROJECTS_MANAGE) ||
      user.permissions.includes(Permission.USERS_MANAGE)
    ) {
      return;
    }

    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: user.id },
    });
    if (!membership) {
      throw new ForbiddenException('Cannot bind folder to a project you do not belong to');
    }
  }

  private async assertNotInUse(folderId: string) {
    const [fileCount, childCount] = await Promise.all([
      this.prisma.storedFile.count({ where: { folderId, deletedAt: null } }),
      this.prisma.storageFolder.count({ where: { parentId: folderId } }),
    ]);

    if (fileCount > 0 || childCount > 0) {
      throw new BadRequestException(
        `Cannot delete folder while it is in use (${fileCount} file(s), ${childCount} child folder(s))`,
      );
    }
  }

  private async getFolderOrThrow(id: string) {
    const folder = await this.prisma.storageFolder.findUnique({ where: { id } });
    if (!folder) {
      throw new NotFoundException('Folder not found');
    }
    return folder;
  }

  private async toRecord(folder: {
    id: string;
    code: string;
    name: string;
    parentId: string | null;
    projectId: string | null;
    bucketName: string;
    prefix: string;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<StorageFolderRecord> {
    const [fileCount, childCount] = await Promise.all([
      this.prisma.storedFile.count({ where: { folderId: folder.id, deletedAt: null } }),
      this.prisma.storageFolder.count({ where: { parentId: folder.id } }),
    ]);

    return {
      id: folder.id,
      code: folder.code,
      name: folder.name,
      parentId: folder.parentId,
      projectId: folder.projectId,
      bucketName: folder.bucketName,
      prefix: folder.prefix,
      createdById: folder.createdById,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
      fileCount,
      childCount,
    };
  }
}
