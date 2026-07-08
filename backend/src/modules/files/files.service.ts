import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { extname } from 'path';
import { Prisma } from '@prisma/client';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { BucketAccessService } from '../../common/services/bucket-access.service';
import { StorageEventsService } from '../storage-events/storage-events.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type {
  DeleteStoredFilesInput,
  FileBatchUploadItemResult,
  FileUploadResult,
  SearchStoredFilesInput,
  StoredFileRecord,
  UpdateStoredFileInput,
} from '@storage/shared';

type UploadedMulterFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type StoredFileRow = {
  id: string;
  bucketName: string;
  objectKey: string;
  path: string;
  originalName: string;
  contentType: string;
  size: bigint;
  contentHash: string;
  module: string;
  ownerId: string;
  projectId: string | null;
  folderId: string | null;
  description: string | null;
  tags: string[];
  customMetadata: Prisma.JsonValue;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
    private readonly bucketAccess: BucketAccessService,
    private readonly storageEvents: StorageEventsService,
  ) {}

  async uploadOne(
    file: UploadedMulterFile,
    user: AuthenticatedUser,
    options: {
      bucket?: string;
      module?: string;
      description?: string;
      tags?: string[];
      folderId?: string;
      projectId?: string;
      pathPrefix?: string;
      customMetadata?: Record<string, unknown>;
    } = {},
  ): Promise<FileUploadResult> {
    this.assertValidUpload(file);

    const { bucket, folder } = await this.resolveBucketAndFolder(
      options.bucket,
      options.folderId,
      user,
    );
    await this.bucketAccess.assertBucketAccess(user, bucket);

    const folderPrefix = folder?.prefix.replace(/^\/+|\/+$/g, '') ?? '';
    const moduleName = (options.module ?? 'default').trim() || 'default';
    const now = new Date();
    const fileId = cryptoRandomUuid();
    const safeName = sanitizeFileName(file.originalname);
    const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const prefixParts = [
      folderPrefix,
      options.pathPrefix?.replace(/^\/+|\/+$/g, ''),
      moduleName,
      datePath,
    ]
      .filter(Boolean)
      .join('/');
    const objectKey = `${prefixParts}/${fileId}-${safeName}`.replace(/\/+/g, '/');
    const path = objectKey;
    const contentHash = createHash('sha256').update(file.buffer).digest('hex');
    const contentType = file.mimetype || 'application/octet-stream';

    await this.bucketAccess.assertObjectKeyAccess(user, bucket, objectKey);
    await this.storageEvents.beforeObjectCreate(bucket, file.size);
    await this.s3.putObject(bucket, objectKey, file.buffer, contentType);

    let created: StoredFileRow;
    try {
      created = await this.prisma.storedFile.create({
        data: {
          id: fileId,
          bucketName: bucket,
          objectKey,
          path,
          originalName: file.originalname,
          contentType,
          size: BigInt(file.size),
          contentHash,
          module: moduleName,
          ownerId: user.id,
          projectId: options.projectId ?? folder?.projectId ?? null,
          folderId: folder?.id ?? null,
          description: options.description,
          tags: options.tags ?? [],
          customMetadata: (options.customMetadata ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      try {
        await this.s3.deleteObjects(bucket, [objectKey]);
      } catch {
        // Best-effort cleanup if DB write fails after S3 put.
      }
      throw error;
    }

    await this.storageEvents.afterObjectCreated(bucket, objectKey, file.size, contentType);
    await this.activity.log({
      userId: user.id,
      action: 'UPLOAD',
      resource: 'stored_file',
      resourceId: created.id,
      metadata: { path, size: file.size, contentType },
    });

    const record = this.toRecord(created);
    return {
      fileId: record.id,
      path: record.path,
      url: this.fileUrl(record.id),
      size: record.size,
      hash: record.contentHash,
      metadata: { ...record, url: this.fileUrl(record.id) },
    };
  }

  async uploadMany(
    files: UploadedMulterFile[],
    user: AuthenticatedUser,
    options: {
      bucket?: string;
      module?: string;
      folderId?: string;
      projectId?: string;
      pathPrefix?: string;
    } = {},
  ): Promise<FileBatchUploadItemResult[]> {
    if (!files.length) {
      throw new BadRequestException('No files provided');
    }

    const results: FileBatchUploadItemResult[] = [];
    for (const file of files) {
      try {
        const data = await this.uploadOne(file, user, options);
        results.push({ success: true, fileName: file.originalname, data });
      } catch (error) {
        results.push({
          success: false,
          fileName: file.originalname,
          error: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }
    return results;
  }

  async getById(id: string, user: AuthenticatedUser, includeDeleted = false) {
    const file = await this.findAccessibleFile({ id }, user, includeDeleted);
    const record = this.toRecord(file);
    return { success: true, data: { ...record, url: this.fileUrl(record.id) } };
  }

  async getByPath(path: string, user: AuthenticatedUser, bucket?: string) {
    if (!path?.trim()) {
      throw new BadRequestException('path is required');
    }
    const file = await this.findAccessibleFile(
      { path: path.trim(), bucketName: bucket },
      user,
      false,
    );
    const record = this.toRecord(file);
    return { success: true, data: { ...record, url: this.fileUrl(record.id) } };
  }

  async downloadById(id: string, user: AuthenticatedUser) {
    const file = await this.findAccessibleFile({ id }, user, false);
    return this.streamFile(file, user);
  }

  async downloadByPath(path: string, user: AuthenticatedUser, bucket?: string) {
    if (!path?.trim()) {
      throw new BadRequestException('path is required');
    }
    const file = await this.findAccessibleFile(
      { path: path.trim(), bucketName: bucket },
      user,
      false,
    );
    return this.streamFile(file, user);
  }

  async update(id: string, input: UpdateStoredFileInput, user: AuthenticatedUser) {
    const file = await this.findAccessibleFile({ id }, user, false);

    let folderId = input.folderId;
    if (folderId !== undefined && folderId !== null) {
      const folder = await this.prisma.storageFolder.findUnique({ where: { id: folderId } });
      if (!folder) {
        throw new NotFoundException('Folder not found');
      }
      if (folder.bucketName !== file.bucketName) {
        throw new BadRequestException('Folder bucket does not match file bucket');
      }
    }

    const updated = await this.prisma.storedFile.update({
      where: { id: file.id },
      data: {
        description: input.description === undefined ? undefined : input.description,
        tags: input.tags,
        module: input.module,
        customMetadata:
          input.customMetadata === undefined
            ? undefined
            : (input.customMetadata as Prisma.InputJsonValue),
        folderId: folderId === undefined ? undefined : folderId,
      },
    });
    return { success: true, data: this.toRecord(updated) };
  }

  async listModules(user: AuthenticatedUser, bucket?: string) {
    const allowedBuckets = await this.bucketAccess.getAccessibleBucketNames(user);
    if (bucket) {
      await this.bucketAccess.assertBucketAccess(user, bucket);
      if (allowedBuckets && !allowedBuckets.includes(bucket)) {
        return { success: true, data: [] as string[] };
      }
    }

    const rows = await this.prisma.storedFile.findMany({
      where: {
        deletedAt: null,
        bucketName: bucket
          ? bucket
          : allowedBuckets
            ? { in: allowedBuckets }
            : undefined,
      },
      distinct: ['module'],
      select: { module: true },
      orderBy: { module: 'asc' },
    });

    const modules = rows.map((row) => row.module);
    if (!modules.includes('default')) {
      modules.unshift('default');
    }
    return { success: true, data: modules };
  }

  async search(query: SearchStoredFilesInput, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const allowedBuckets = await this.bucketAccess.getAccessibleBucketNames(user);

    if (query.bucket) {
      await this.bucketAccess.assertBucketAccess(user, query.bucket);
      if (allowedBuckets && !allowedBuckets.includes(query.bucket)) {
        throw new ForbiddenException(`Access denied to bucket "${query.bucket}"`);
      }
    }

    const where: Prisma.StoredFileWhereInput = {
      deletedAt: query.trashed ? { not: null } : null,
      bucketName: query.bucket
        ? query.bucket
        : allowedBuckets
          ? { in: allowedBuckets }
          : undefined,
      ownerId: query.ownerId,
      module: query.module,
      folderId: query.folderId,
      projectId: query.projectId,
      size:
        query.minSize !== undefined || query.maxSize !== undefined
          ? {
              gte: query.minSize !== undefined ? BigInt(query.minSize) : undefined,
              lte: query.maxSize !== undefined ? BigInt(query.maxSize) : undefined,
            }
          : undefined,
      createdAt:
        query.createdFrom || query.createdTo
          ? {
              gte: query.createdFrom,
              lte: query.createdTo,
            }
          : undefined,
    };

    const andFilters: Prisma.StoredFileWhereInput[] = [];
    if (query.name) {
      andFilters.push({ originalName: { contains: query.name, mode: 'insensitive' } });
    }
    if (query.extension) {
      const ext = query.extension.replace(/^\./, '').toLowerCase();
      andFilters.push({
        OR: [
          { originalName: { endsWith: `.${ext}`, mode: 'insensitive' } },
          { contentType: { contains: ext, mode: 'insensitive' } },
        ],
      });
    }
    if (andFilters.length) {
      where.AND = andFilters;
    }

    // Over-fetch then filter by prefix grants so pagination stays meaningful for scoped users.
    const fetchTake = Math.min(limit * 5, 500);
    const rows = await this.prisma.storedFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: fetchTake,
    });

    const accessibleRows = await this.filterRowsByPrefixAccess(user, rows);
    const visibleRows = query.trashed
      ? accessibleRows
      : await this.reconcileMissingObjects(accessibleRows);
    const total = visibleRows.length;
    const pageRows = visibleRows.slice((page - 1) * limit, page * limit);
    const storageAvailability = query.trashed
      ? await this.checkStorageAvailability(pageRows)
      : new Map(pageRows.map((row) => [row.id, true] as const));

    return {
      success: true,
      data: pageRows.map((row) => ({
        ...this.toRecord(row),
        url: this.fileUrl(row.id),
        storageAvailable: storageAvailability.get(row.id) ?? true,
      })),
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

  async deleteMany(input: DeleteStoredFilesInput, user: AuthenticatedUser) {
    const softDeleteEnabled = this.config.get<boolean>('files.softDeleteEnabled') ?? true;
    const hard = input.hard === true || !softDeleteEnabled;

    const files = await this.resolveTargets(input, user, hard);
    if (!files.length) {
      throw new NotFoundException('No matching files found');
    }

    const deletedIds: string[] = [];
    for (const file of files) {
      await this.bucketAccess.assertObjectKeyAccess(user, file.bucketName, file.objectKey);

      if (hard) {
        await this.s3.deleteObjects(file.bucketName, [file.objectKey]);
        await this.prisma.storedFile.delete({ where: { id: file.id } });
        await this.storageEvents.afterObjectsDeleted(file.bucketName, [
          { key: file.objectKey, size: Number(file.size) },
        ]);
      } else {
        await this.prisma.storedFile.update({
          where: { id: file.id },
          data: { deletedAt: new Date() },
        });
      }

      deletedIds.push(file.id);
      await this.activity.log({
        userId: user.id,
        action: 'DELETE',
        resource: 'stored_file',
        resourceId: file.id,
        metadata: { hard, path: file.path },
      });
    }

    return {
      success: true,
      data: { deletedIds, mode: hard ? 'hard' : 'soft' },
      message: hard ? 'Files permanently deleted' : 'Files soft-deleted',
    };
  }

  async restore(id: string, user: AuthenticatedUser) {
    const file = await this.findAccessibleFile({ id }, user, true);
    if (!file.deletedAt) {
      throw new BadRequestException('File is not in trash');
    }

    try {
      await this.s3.getObjectMetadata(file.bucketName, file.objectKey);
    } catch {
      throw new BadRequestException(
        'Cannot restore this file because the object was removed from bucket storage',
      );
    }

    const restored = await this.prisma.storedFile.update({
      where: { id: file.id },
      data: { deletedAt: null },
    });
    return { success: true, data: this.toRecord(restored) };
  }

  async purge(id: string, user: AuthenticatedUser) {
    const file = await this.findAccessibleFile({ id }, user, true);
    try {
      await this.s3.deleteObjects(file.bucketName, [file.objectKey]);
    } catch {
      // Object may already be gone if deleted from the bucket explorer.
    }
    await this.prisma.storedFile.delete({ where: { id: file.id } });
    await this.storageEvents.afterObjectsDeleted(file.bucketName, [
      { key: file.objectKey, size: Number(file.size) },
    ]);
    return { success: true, message: 'File purged' };
  }

  private async streamFile(file: StoredFileRow, user: AuthenticatedUser) {
    await this.bucketAccess.assertObjectKeyAccess(user, file.bucketName, file.objectKey);
    const { stream, contentType, contentLength } = await this.s3.getObjectStream(
      file.bucketName,
      file.objectKey,
    );

    await this.activity.log({
      userId: user.id,
      action: 'DOWNLOAD',
      resource: 'stored_file',
      resourceId: file.id,
      metadata: { size: contentLength ?? Number(file.size) },
    });

    return new StreamableFile(stream, {
      type: contentType ?? file.contentType,
      disposition: safeContentDisposition(file.originalName),
      length: contentLength ?? Number(file.size),
    });
  }

  private assertValidUpload(file: UploadedMulterFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file');
    }

    const maxBytes = this.config.get<number>('files.maxUploadBytes') ?? 100 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(`File exceeds maximum size of ${maxBytes} bytes`);
    }

    const allowedExtensions = this.config.get<string[]>('files.allowedExtensions') ?? [];
    if (allowedExtensions.length) {
      const ext = extname(file.originalname).replace(/^\./, '').toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        throw new BadRequestException(`File extension ".${ext}" is not allowed`);
      }
    }

    const allowedMimeTypes = this.config.get<string[]>('files.allowedMimeTypes') ?? [];
    if (allowedMimeTypes.length) {
      const mime = (file.mimetype || '').toLowerCase();
      const ok = allowedMimeTypes.some(
        (allowed) =>
          mime === allowed || (allowed.endsWith('/*') && mime.startsWith(allowed.slice(0, -1))),
      );
      if (!ok) {
        throw new BadRequestException(`MIME type "${file.mimetype}" is not allowed`);
      }
    }
  }

  private async resolveBucketAndFolder(
    bucket: string | undefined,
    folderId: string | undefined,
    user: AuthenticatedUser,
  ): Promise<{
    bucket: string;
    folder: { id: string; prefix: string; projectId: string | null; bucketName: string } | null;
  }> {
    if (folderId) {
      const folder = await this.prisma.storageFolder.findUnique({ where: { id: folderId } });
      if (!folder) throw new NotFoundException('Folder not found');
      if (bucket && bucket !== folder.bucketName) {
        throw new BadRequestException('bucket does not match folder bucket');
      }
      return {
        bucket: folder.bucketName,
        folder: {
          id: folder.id,
          prefix: folder.prefix,
          projectId: folder.projectId,
          bucketName: folder.bucketName,
        },
      };
    }

    if (bucket) {
      await this.bucketAccess.assertBucketAccess(user, bucket);
      return { bucket, folder: null };
    }

    const defaultBucket = this.config.get<string>('files.defaultBucket');
    if (defaultBucket) {
      await this.bucketAccess.assertBucketAccess(user, defaultBucket);
      return { bucket: defaultBucket, folder: null };
    }

    const accessible = await this.bucketAccess.getAccessibleBucketNames(user);
    if (accessible?.length === 1) return { bucket: accessible[0], folder: null };

    throw new BadRequestException('bucket is required');
  }

  private async findAccessibleFile(
    where: { id?: string; path?: string; bucketName?: string },
    user: AuthenticatedUser,
    includeDeleted: boolean,
  ) {
    if (where.path !== undefined && !where.path.trim()) {
      throw new BadRequestException('path is required');
    }

    const file = await this.prisma.storedFile.findFirst({
      where: {
        id: where.id,
        ...(where.path !== undefined ? { path: where.path } : {}),
        ...(where.bucketName ? { bucketName: where.bucketName } : {}),
        deletedAt: includeDeleted ? undefined : null,
      },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    await this.bucketAccess.assertObjectKeyAccess(user, file.bucketName, file.objectKey);
    if (!includeDeleted && file.deletedAt) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  private async resolveTargets(
    input: DeleteStoredFilesInput,
    user: AuthenticatedUser,
    hard: boolean,
  ) {
    const deletedFilter = hard ? {} : { deletedAt: null as null };

    const byId =
      input.ids?.length
        ? await this.prisma.storedFile.findMany({
            where: { id: { in: input.ids }, ...deletedFilter },
          })
        : [];

    const byPath =
      input.paths?.length
        ? await this.prisma.storedFile.findMany({
            where: {
              path: { in: input.paths },
              ...(input.bucket ? { bucketName: input.bucket } : {}),
              ...deletedFilter,
            },
          })
        : [];

    const map = new Map<string, StoredFileRow>();
    for (const file of [...byId, ...byPath]) {
      map.set(file.id, file);
    }

    const files = [...map.values()];
    for (const file of files) {
      await this.bucketAccess.assertObjectKeyAccess(user, file.bucketName, file.objectKey);
    }
    return files;
  }

  private async checkStorageAvailability(rows: StoredFileRow[]): Promise<Map<string, boolean>> {
    const availability = new Map<string, boolean>();
    if (!rows.length) {
      return availability;
    }

    const checks = await Promise.all(
      rows.map(async (row) => {
        try {
          await this.s3.getObjectMetadata(row.bucketName, row.objectKey);
          return { id: row.id, available: true as const };
        } catch {
          return { id: row.id, available: false as const };
        }
      }),
    );

    for (const check of checks) {
      availability.set(check.id, check.available);
    }

    return availability;
  }

  private async reconcileMissingObjects(rows: StoredFileRow[]): Promise<StoredFileRow[]> {
    if (!rows.length) {
      return rows;
    }

    const availability = await this.checkStorageAvailability(rows);
    const missingIds = rows.filter((row) => availability.get(row.id) === false).map((row) => row.id);
    const visible = rows.filter((row) => availability.get(row.id) !== false);

    if (!missingIds.length) {
      visible.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return visible;
    }

    const softDeleteEnabled = this.config.get<boolean>('files.softDeleteEnabled') ?? true;
    if (softDeleteEnabled) {
      await this.prisma.storedFile.updateMany({
        where: { id: { in: missingIds }, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    } else {
      await this.prisma.storedFile.deleteMany({
        where: { id: { in: missingIds } },
      });
    }

    visible.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return visible;
  }

  private async filterRowsByPrefixAccess(
    user: AuthenticatedUser,
    rows: StoredFileRow[],
  ): Promise<StoredFileRow[]> {
    const byBucket = new Map<string, StoredFileRow[]>();
    for (const row of rows) {
      const group = byBucket.get(row.bucketName) ?? [];
      group.push(row);
      byBucket.set(row.bucketName, group);
    }

    const accessible: StoredFileRow[] = [];
    for (const [bucketName, group] of byBucket) {
      const filtered = await this.bucketAccess.filterObjectsByPrefix(
        user,
        bucketName,
        group.map((row) => ({ ...row, key: row.objectKey })),
      );
      accessible.push(...filtered.map(({ key: _key, ...row }) => row));
    }

    accessible.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return accessible;
  }

  private fileUrl(id: string): string {
    const appUrl = (this.config.get<string>('appUrl') ?? 'http://localhost:3000').replace(/\/$/, '');
    const apiBase = process.env.API_PUBLIC_URL ?? process.env.NEXT_PUBLIC_API_URL;
    if (apiBase) {
      return `${apiBase.replace(/\/$/, '')}/files/${id}/download`;
    }
    return `${appUrl.replace(/:\d+$/, ':4000')}/api/v1/files/${id}/download`;
  }

  private toRecord(file: StoredFileRow): StoredFileRecord {
    return {
      id: file.id,
      bucketName: file.bucketName,
      objectKey: file.objectKey,
      path: file.path,
      originalName: file.originalName,
      contentType: file.contentType,
      size: file.size.toString(),
      contentHash: file.contentHash,
      module: file.module,
      ownerId: file.ownerId,
      projectId: file.projectId,
      folderId: file.folderId,
      description: file.description,
      tags: file.tags,
      customMetadata:
        file.customMetadata &&
        typeof file.customMetadata === 'object' &&
        !Array.isArray(file.customMetadata)
          ? (file.customMetadata as Record<string, unknown>)
          : {},
      deletedAt: file.deletedAt?.toISOString() ?? null,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    };
  }
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file';
  return base.replace(/[^\w.\-()+ ]+/g, '_').replace(/[\r\n]/g, '').slice(0, 180) || 'file';
}

function safeContentDisposition(name: string): string {
  const cleaned = name.replace(/[\r\n"]/g, '_').slice(0, 180) || 'file';
  return `attachment; filename="${cleaned}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}

function cryptoRandomUuid(): string {
  return globalThis.crypto.randomUUID();
}
