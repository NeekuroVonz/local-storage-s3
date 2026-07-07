import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { RolesDocs } from '../../common/swagger/docs';
import { Permission } from '@storage/shared';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(Permission.ROLES_READ)
  @DocumentedEndpoint(RolesDocs.list)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('permissions')
  @RequirePermissions(Permission.ROLES_READ)
  @DocumentedEndpoint(RolesDocs.listPermissions)
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Post()
  @RequirePermissions(Permission.ROLES_WRITE)
  @DocumentedEndpoint(RolesDocs.create)
  create(@Body() body: { name: string; displayName: string; description?: string; permissions: string[] }) {
    return this.rolesService.create(body);
  }

  @Patch(':id/permissions')
  @RequirePermissions(Permission.ROLES_WRITE)
  @DocumentedEndpoint(RolesDocs.updatePermissions)
  updatePermissions(@Param('id') id: string, @Body() body: { permissions: string[] }) {
    return this.rolesService.updatePermissions(id, body.permissions);
  }
}
