import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { JwtOnly } from '../../common/decorators/jwt-only.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { UsersDocs } from '../../common/swagger/docs';
import {
  createUserSchema,
  updateUserProjectsSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  CreateUserInput,
  UpdateUserProjectsInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
  Permission,
} from '@storage/shared';

@ApiTags('Users')
@ApiBearerAuth()
@JwtOnly()
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

  @Post()
  @RequirePermissions(Permission.USERS_MANAGE)
  @DocumentedEndpoint(UsersDocs.create)
  create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    return this.usersService.create(body);
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
  updateRole(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserRoleSchema)) body: UpdateUserRoleInput,
  ) {
    return this.usersService.updateRole(id, body.roleId);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.USERS_MANAGE)
  @DocumentedEndpoint(UsersDocs.updateStatus)
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema)) body: UpdateUserStatusInput,
  ) {
    return this.usersService.updateStatus(id, body.status);
  }

  @Patch(':id/projects')
  @RequirePermissions(Permission.USERS_MANAGE)
  @DocumentedEndpoint(UsersDocs.updateProjects)
  updateProjects(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserProjectsSchema)) body: UpdateUserProjectsInput,
  ) {
    return this.usersService.updateProjects(id, body);
  }
}
