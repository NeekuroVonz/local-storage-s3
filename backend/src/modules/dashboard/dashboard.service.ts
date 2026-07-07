import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { DashboardStats } from '@storage/shared';

@Injectable()
export class DashboardService {
  constructor(
    private readonly s3: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  async getStats(): Promise<{ success: boolean; data: DashboardStats & { storageConnected: boolean } }> {
    let buckets: Awaited<ReturnType<S3Service['listBuckets']>> = [];
    let storageConnected = true;

    try {
      buckets = await this.s3.listBuckets();
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        storageConnected = false;
      } else {
        throw error;
      }
    }
    let totalObjects = 0;
    let storageUsed = 0;

    for (const bucket of buckets) {
      totalObjects += bucket.objectCount;
      storageUsed += bucket.size;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [uploadsToday, downloadsToday, activeUsers, storageYesterday] = await Promise.all([
      this.getMetricValue('uploads', today),
      this.getMetricValue('downloads', today),
      this.prisma.user.count({ where: { lastLoginAt: { gte: today } } }),
      this.getMetricValue('storage_used', yesterday),
    ]);

    const storageGrowth = storageYesterday > 0
      ? ((storageUsed - storageYesterday) / storageYesterday) * 100
      : 0;

    const recentActivity = await this.prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });

    return {
      success: true,
      data: {
        totalBuckets: buckets.length,
        totalObjects,
        storageUsed,
        storageGrowth,
        uploadsToday,
        downloadsToday,
        activeUsers,
        bandwidthUsed: 0,
        storageConnected,
      },
    };
  }

  async getRecentActivity() {
    const activity = await this.prisma.activityLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    return { success: true, data: activity };
  }

  private async getMetricValue(metric: string, date: Date): Promise<number> {
    const record = await this.prisma.dailyMetric.findUnique({
      where: { date_metric: { date, metric } },
    });
    return record ? Number(record.value) : 0;
  }
}
