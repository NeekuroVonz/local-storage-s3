import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FoldersService } from './folders.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { FoldersDocs } from '../../common/swagger/docs/files.docs';
import {
  createStorageFolderSchema,
  searchStorageFoldersSchema,
  updateStorageFolderSchema,
  CreateStorageFolderInput,
  SearchStorageFoldersInput,
  UpdateStorageFolderInput,
  Permission,
} from '@storage/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Folders')
@ApiBearerAuth()
@Controller('folders')
@UseGuards(PermissionsGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(FoldersDocs.list)
  list(
    @Query(new ZodValidationPipe(searchStorageFoldersSchema)) query: SearchStorageFoldersInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.foldersService.list(query, user);
  }

  @Get('bindings')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(FoldersDocs.bindings)
  bindings(@Query('projectId') projectId: string, @User() user: AuthenticatedUser) {
    if (!projectId?.trim()) {
      throw new BadRequestException('projectId is required');
    }
    return this.foldersService.listBindings(projectId, user);
  }

  @Get('search')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(FoldersDocs.search)
  search(
    @Query(new ZodValidationPipe(searchStorageFoldersSchema)) query: SearchStorageFoldersInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.foldersService.search(query, user);
  }

  @Post()
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(FoldersDocs.create)
  create(
    @Body(new ZodValidationPipe(createStorageFolderSchema)) body: CreateStorageFolderInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.foldersService.create(body, user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(FoldersDocs.update)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStorageFolderSchema)) body: UpdateStorageFolderInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.foldersService.update(id, body, user);
  }

  @Delete(':id')
  @RequirePermissions(Permission.OBJECTS_DELETE)
  @DocumentedEndpoint(FoldersDocs.remove)
  remove(@Param('id') id: string, @User() user: AuthenticatedUser) {
    return this.foldersService.remove(id, user);
  }
}
