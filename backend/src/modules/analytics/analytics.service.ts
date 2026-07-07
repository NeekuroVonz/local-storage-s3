import { Injectable } from '@nestjs/common';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly s3: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  async getStorageAnalytics() {
    const buckets = await this.s3.listBuckets();

    const storageByBucket = await Promise.all(
      buckets.map(async (b) => ({
        bucket: b.name,
        size: b.size,
        objectCount: b.objectCount,
      })),
    );

    const uploadsPerDay = await this.getMetricsForDays('uploads', 30);
    const downloadsPerDay = await this.getMetricsForDays('downloads', 30);

    const fileTypes = await this.getFileTypeDistribution(buckets.map((b) => b.name));

    const largestBuckets = [...storageByBucket]
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    let largestFiles: Array<{ key: string; name: string; size: number; bucket: string }> = [];
    for (const bucket of buckets.slice(0, 5)) {
      const result = await this.s3.listObjects(bucket.name, '', '', undefined, 1000);
      const files = result.objects
        .filter((o) => !o.isFolder)
        .map((o) => ({ key: o.key, name: o.name, size: o.size, bucket: bucket.name }));
      largestFiles.push(...files);
    }
    largestFiles = largestFiles.sort((a, b) => b.size - a.size).slice(0, 20);

    return {
      success: true,
      data: {
        storageByBucket,
        uploadsPerDay,
        downloadsPerDay,
        fileTypes,
        largestFiles,
        largestBuckets,
      },
    };
  }

  private async getMetricsForDays(metric: string, days: number) {
    const results: Array<{ date: string; count: number }> = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const record = await this.prisma.dailyMetric.findUnique({
        where: { date_metric: { date, metric } },
      });

      results.push({
        date: date.toISOString().split('T')[0],
        count: record ? Number(record.value) : 0,
      });
    }

    return results;
  }

  private async getFileTypeDistribution(bucketNames: string[]) {
    const typeMap = new Map<string, { count: number; size: number }>();

    for (const bucketName of bucketNames.slice(0, 10)) {
      const result = await this.s3.listObjects(bucketName, '', '', undefined, 1000);
      for (const obj of result.objects) {
        if (obj.isFolder) continue;
        const ext = obj.name.split('.').pop()?.toLowerCase() ?? 'unknown';
        const existing = typeMap.get(ext) ?? { count: 0, size: 0 };
        typeMap.set(ext, { count: existing.count + 1, size: existing.size + obj.size });
      }
    }

    return Array.from(typeMap.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.size - a.size);
  }
}
