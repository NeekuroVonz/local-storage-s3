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
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  AnyFilesInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { FilesService } from './files.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { FilesDocs } from '../../common/swagger/docs/files.docs';
import {
  deleteStoredFilesSchema,
  searchStoredFilesSchema,
  updateStoredFileSchema,
  DeleteStoredFilesInput,
  SearchStoredFilesInput,
  UpdateStoredFileInput,
  Permission,
} from '@storage/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

const maxUploadBytes = Number(process.env.UPLOAD_MAX_BYTES ?? 100 * 1024 * 1024);
const multerMemory = {
  storage: memoryStorage(),
  limits: {
    fileSize: Number.isFinite(maxUploadBytes) && maxUploadBytes > 0 ? maxUploadBytes : 100 * 1024 * 1024,
    files: 50,
  },
};

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
@UseGuards(PermissionsGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @UseInterceptors(FileInterceptor('file', multerMemory))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        bucket: { type: 'string' },
        module: { type: 'string' },
        description: { type: 'string' },
        tags: { type: 'string', description: 'Comma-separated tags' },
        folderId: { type: 'string', format: 'uuid' },
        projectId: { type: 'string', format: 'uuid' },
        pathPrefix: { type: 'string' },
      },
   },
  })
  @DocumentedEndpoint(FilesDocs.upload)
  upload(
    @UploadedFile() file: Express.Multer.File,
    @User() user: AuthenticatedUser,
    @Query('bucket') bucket?: string,
    @Body()
    body?: {
      bucket?: string;
      module?: string;
      description?: string;
      tags?: string;
      folderId?: string;
      projectId?: string;
      pathPrefix?: string;
    },
  ) {
    return this.filesService
      .uploadOne(file, user, {
        bucket: body?.bucket ?? bucket,
        module: body?.module,
        description: body?.description,
        tags: parseTags(body?.tags),
        folderId: body?.folderId,
        projectId: body?.projectId,
        pathPrefix: body?.pathPrefix,
      })
      .then((data) => ({ success: true, data }));
  }

  @Post('upload/batch')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @UseInterceptors(AnyFilesInterceptor(multerMemory))
  @ApiConsumes('multipart/form-data')
  @DocumentedEndpoint(FilesDocs.uploadBatch)
  uploadBatch(
    @UploadedFiles() uploaded: Express.Multer.File[],
    @User() user: AuthenticatedUser,
    @Body()
    body?: {
      bucket?: string;
      module?: string;
      folderId?: string;
      projectId?: string;
      pathPrefix?: string;
    },
  ) {
    const files = (uploaded ?? []).filter(
      (item) => item.fieldname === 'files' || item.fieldname === 'file',
    );
    return this.filesService
      .uploadMany(files, user, {
        bucket: body?.bucket,
        module: body?.module,
        folderId: body?.folderId,
        projectId: body?.projectId,
        pathPrefix: body?.pathPrefix,
      })
      .then((data) => ({ success: true, data }));
  }

  @Get()
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(FilesDocs.search)
  search(
    @Query(new ZodValidationPipe(searchStoredFilesSchema)) query: SearchStoredFilesInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.filesService.search(query, user);
  }

  @Get('modules')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(FilesDocs.listModules)
  listModules(@User() user: AuthenticatedUser, @Query('bucket') bucket?: string) {
    return this.filesService.listModules(user, bucket);
  }

  @Get('by-path')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(FilesDocs.getByPath)
  getByPath(
    @Query('path') path: string,
    @User() user: AuthenticatedUser,
    @Query('bucket') bucket?: string,
  ) {
    if (!path?.trim()) {
      throw new BadRequestException('path is required');
    }
    return this.filesService.getByPath(path, user, bucket);
  }

  @Get('download/by-path')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(FilesDocs.downloadByPath)
  downloadByPath(
    @Query('path') path: string,
    @User() user: AuthenticatedUser,
    @Query('bucket') bucket?: string,
  ) {
    if (!path?.trim()) {
      throw new BadRequestException('path is required');
    }
    return this.filesService.downloadByPath(path, user, bucket);
  }

  @Get(':id/download')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(FilesDocs.downloadById)
  downloadById(@Param('id') id: string, @User() user: AuthenticatedUser) {
    return this.filesService.downloadById(id, user);
  }

  @Get(':id')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(FilesDocs.getById)
  getById(@Param('id') id: string, @User() user: AuthenticatedUser) {
    return this.filesService.getById(id, user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(FilesDocs.update)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStoredFileSchema)) body: UpdateStoredFileInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.filesService.update(id, body, user);
  }

  @Delete()
  @RequirePermissions(Permission.OBJECTS_DELETE)
  @DocumentedEndpoint(FilesDocs.deleteMany)
  deleteMany(
    @Body(new ZodValidationPipe(deleteStoredFilesSchema)) body: DeleteStoredFilesInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.filesService.deleteMany(body, user);
  }

  @Post(':id/restore')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(FilesDocs.restore)
  restore(@Param('id') id: string, @User() user: AuthenticatedUser) {
    return this.filesService.restore(id, user);
  }

  @Delete(':id/purge')
  @RequirePermissions(Permission.OBJECTS_DELETE)
  @DocumentedEndpoint(FilesDocs.purge)
  purge(@Param('id') id: string, @User() user: AuthenticatedUser) {
    return this.filesService.purge(id, user);
  }
}

function parseTags(value?: string): string[] | undefined {
  if (!value?.trim()) return undefined;
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}
