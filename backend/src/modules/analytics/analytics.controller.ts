import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { AnalyticsDocs } from '../../common/swagger/docs';
import { Permission } from '@storage/shared';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  @RequirePermissions(Permission.ANALYTICS_READ)
  @DocumentedEndpoint(AnalyticsDocs.get)
  getAnalytics() {
    return this.analyticsService.getStorageAnalytics();
  }
}
