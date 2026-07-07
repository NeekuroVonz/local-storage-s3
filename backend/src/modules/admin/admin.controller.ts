import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { S3Service } from '../../infrastructure/storage/s3.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { AdminDocs } from '../../common/swagger/docs';
import { Permission } from '@storage/shared';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PermissionsGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  @RequirePermissions(Permission.ADMIN_READ)
  @DocumentedEndpoint(AdminDocs.health)
  async getSystemHealth() {
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.getClient().ping(),
      this.s3.listBuckets(),
    ]);

    return {
      success: true,
      data: {
        postgres: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        s3: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('stats')
  @RequirePermissions(Permission.ADMIN_READ)
  @DocumentedEndpoint(AdminDocs.stats)
  async getSystemStats() {
    const [userCount, roleCount, activityCount, uploadJobs] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.role.count(),
      this.prisma.activityLog.count(),
      this.prisma.uploadJob.count({ where: { status: 'in_progress' } }),
    ]);

    return {
      success: true,
      data: { userCount, roleCount, activityCount, activeUploads: uploadJobs },
    };
  }
}
