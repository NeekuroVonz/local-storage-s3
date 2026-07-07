import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { DashboardDocs } from '../../common/swagger/docs';
import { Permission } from '@storage/shared';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermissions(Permission.ANALYTICS_READ)
  @DocumentedEndpoint(DashboardDocs.stats)
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('activity')
  @RequirePermissions(Permission.ANALYTICS_READ)
  @DocumentedEndpoint(DashboardDocs.activity)
  getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }
}
