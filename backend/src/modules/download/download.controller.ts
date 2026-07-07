import { Controller, Get, Param, Query, UseGuards, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DownloadService } from './download.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BucketAccessGuard } from '../../common/guards/bucket-access.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { DownloadDocs } from '../../common/swagger/docs';
import { Permission } from '@storage/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Download')
@ApiBearerAuth()
@Controller('buckets/:bucket/download')
@UseGuards(PermissionsGuard, BucketAccessGuard)
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  @Get()
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(DownloadDocs.single)
  download(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.downloadService.downloadObject(bucket, key, user);
  }

  @Post('zip')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(DownloadDocs.zip)
  downloadZip(
    @Param('bucket') bucket: string,
    @Body() body: { keys: string[] },
    @User() user: AuthenticatedUser,
  ) {
    return this.downloadService.downloadAsZip(bucket, body.keys, user);
  }
}
