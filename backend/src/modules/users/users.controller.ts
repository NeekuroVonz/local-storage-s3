import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { UsersDocs } from '../../common/swagger/docs';
import { Permission } from '@storage/shared';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(Permission.USERS_READ)
  @DocumentedEndpoint(UsersDocs.list)
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(page, limit, search);
  }

  @Get(':id')
  @RequirePermissions(Permission.USERS_READ)
  @DocumentedEndpoint(UsersDocs.getOne)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/role')
  @RequirePermissions(Permission.USERS_MANAGE)
  @DocumentedEndpoint(UsersDocs.updateRole)
  updateRole(@Param('id') id: string, @Body() body: { roleId: string }) {
    return this.usersService.updateRole(id, body.roleId);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.USERS_MANAGE)
  @DocumentedEndpoint(UsersDocs.updateStatus)
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' },
  ) {
    return this.usersService.updateStatus(id, body.status);
  }
}
