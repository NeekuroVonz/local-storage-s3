import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ActivityAction } from '@prisma/client';
import { ActivityService } from './activity.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { ActivityDocs } from '../../common/swagger/docs';
import { Permission } from '@storage/shared';

@ApiTags('Activity')
@ApiBearerAuth()
@Controller('activity')
@UseGuards(PermissionsGuard)
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  @DocumentedEndpoint(ActivityDocs.list)
  findAll(
    @Query('userId') userId?: string,
    @Query('action') action?: ActivityAction,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activityService.findAll({ userId, action, page, limit });
  }

  @Get('export')
  @RequirePermissions(Permission.AUDIT_READ)
  @DocumentedEndpoint(ActivityDocs.export)
  async export(@Query('userId') userId: string | undefined, @Res() res: Response) {
    const csv = await this.activityService.exportCsv(userId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=activity-logs.csv');
    res.send(csv);
  }
}
