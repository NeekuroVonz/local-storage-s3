import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BucketAccessService } from '../../common/services/bucket-access.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly s3: S3Service,
    private readonly prisma: PrismaService,
    private readonly bucketAccess: BucketAccessService,
  ) {}

  async search(
    user: AuthenticatedUser,
    params: {
    query: string;
    bucket?: string;
    prefix?: string;
    fileType?: string;
    minSize?: number;
    maxSize?: number;
    limit?: number;
  }) {
    const query = params.query?.trim();
    if (!query) {
      throw new BadRequestException('Search query is required');
    }

    const limit = params.limit ?? 50;
    const prefix = params.prefix ?? '';
    let results: Array<{ bucket: string; key: string; name: string; size: number; lastModified: string }> = [];

    const bucketsToSearch = params.bucket
      ? [{ name: params.bucket }]
      : await this.s3.listBuckets();

    const accessibleBuckets = await this.bucketAccess.filterBuckets(user, bucketsToSearch);

    if (params.bucket) {
      await this.bucketAccess.assertBucketAccess(user, params.bucket);
      await this.bucketAccess.assertListPrefixAccess(user, params.bucket, prefix);
    }

    for (const bucket of accessibleBuckets) {
      if (results.length >= limit) break;

      try {
        const objects = await this.s3.searchObjects(
          bucket.name,
          query,
          prefix,
          limit - results.length,
        );
        const filtered = await this.bucketAccess.filterObjectsByPrefix(user, bucket.name, objects);
        results.push(
          ...filtered.map((obj) => ({
            bucket: bucket.name,
            key: obj.key,
            name: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
          })),
        );
      } catch (error) {
        this.logger.warn(`Search skipped for bucket "${bucket.name}": ${error instanceof Error ? error.message : error}`);
      }
    }

    if (params.fileType) {
      const ext = params.fileType.toLowerCase();
      results = results.filter((r) => r.name.toLowerCase().endsWith(`.${ext}`));
    }

    if (params.minSize !== undefined) {
      results = results.filter((r) => r.size >= params.minSize!);
    }

    if (params.maxSize !== undefined) {
      results = results.filter((r) => r.size <= params.maxSize!);
    }

    return { success: true, data: results.slice(0, limit) };
  }

  async saveSearch(userId: string, name: string, query: Record<string, unknown>) {
    const saved = await this.prisma.savedSearch.create({
      data: { userId, name, query: query as Prisma.InputJsonValue },
    });
    return { success: true, data: saved };
  }

  async getSavedSearches(userId: string) {
    const searches = await this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return { success: true, data: searches };
  }

  async deleteSavedSearch(userId: string, id: string) {
    await this.prisma.savedSearch.deleteMany({ where: { id, userId } });
    return { success: true, message: 'Search deleted' };
  }
}
