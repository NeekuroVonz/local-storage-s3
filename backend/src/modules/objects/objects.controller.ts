import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ObjectsService } from './objects.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BucketAccessGuard } from '../../common/guards/bucket-access.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { ObjectsDocs } from '../../common/swagger/docs';
import {
  listObjectsSchema,
  createFolderSchema,
  renameObjectSchema,
  copyObjectSchema,
  moveObjectSchema,
  deleteObjectsSchema,
  presignedUrlSchema,
  ListObjectsInput,
  CreateFolderInput,
  RenameObjectInput,
  CopyObjectInput,
  MoveObjectInput,
  DeleteObjectsInput,
  PresignedUrlInput,
  Permission,
} from '@storage/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Objects')
@ApiBearerAuth()
@Controller('buckets/:bucket/objects')
@UseGuards(PermissionsGuard, BucketAccessGuard)
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Get()
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(ObjectsDocs.list)
  list(
    @Param('bucket') bucket: string,
    @Query(new ZodValidationPipe(listObjectsSchema)) query: ListObjectsInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.objectsService.list(bucket, query, user);
  }

  @Get('metadata')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(ObjectsDocs.metadata)
  getMetadata(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.objectsService.getMetadata(bucket, key, user);
  }

  @Post('folder')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(ObjectsDocs.createFolder)
  createFolder(
    @Param('bucket') bucket: string,
    @Body(new ZodValidationPipe(createFolderSchema)) body: CreateFolderInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.objectsService.createFolder(bucket, body, user);
  }

  @Post('rename')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(ObjectsDocs.rename)
  rename(
    @Param('bucket') bucket: string,
    @Body(new ZodValidationPipe(renameObjectSchema)) body: RenameObjectInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.objectsService.rename(bucket, body, user);
  }

  @Post('copy')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(ObjectsDocs.copy)
  copy(
    @Param('bucket') bucket: string,
    @Body(new ZodValidationPipe(copyObjectSchema)) body: CopyObjectInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.objectsService.copy(bucket, body, user);
  }

  @Post('move')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(ObjectsDocs.move)
  move(
    @Param('bucket') bucket: string,
    @Body(new ZodValidationPipe(moveObjectSchema)) body: MoveObjectInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.objectsService.move(bucket, body, user);
  }

  @Delete()
  @RequirePermissions(Permission.OBJECTS_DELETE)
  @DocumentedEndpoint(ObjectsDocs.deleteMany)
  deleteMany(
    @Param('bucket') bucket: string,
    @Body(new ZodValidationPipe(deleteObjectsSchema)) body: DeleteObjectsInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.objectsService.deleteMany(bucket, body, user);
  }

  @Post('presigned-url')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(ObjectsDocs.presignedUrl)
  presignedUrl(
    @Param('bucket') bucket: string,
    @Body(new ZodValidationPipe(presignedUrlSchema)) body: PresignedUrlInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.objectsService.getPresignedUrl(bucket, body, user);
  }
}
