import { Controller, Get, Post, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { ShareService } from './share.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions, Public } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { ShareDocs } from '../../common/swagger/docs';
import { createShareSchema, CreateShareInput, Permission } from '@storage/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Share')
@Controller('shares')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.SHARES_WRITE)
  @DocumentedEndpoint(ShareDocs.create)
  create(
    @Body(new ZodValidationPipe(createShareSchema)) body: CreateShareInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.shareService.create(body, user.id);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.SHARES_READ)
  @DocumentedEndpoint(ShareDocs.list)
  findAll(@User() user: AuthenticatedUser) {
    return this.shareService.findAll(user.id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.SHARES_DELETE)
  @DocumentedEndpoint(ShareDocs.revoke)
  revoke(@Param('id') id: string, @User() user: AuthenticatedUser) {
    return this.shareService.revoke(user.id, id);
  }

  @Public()
  @Post(':token/access')
  @DocumentedEndpoint(ShareDocs.access)
  access(
    @Param('token') token: string,
    @Body() body: { password?: string },
    @Req() req: Request,
  ) {
    return this.shareService.accessShare(token, body.password, req.ip);
  }
}
