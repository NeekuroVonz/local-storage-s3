import {
  Controller,
  Post,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Query,
  Get,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { BucketAccessGuard } from '../../common/guards/bucket-access.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { UploadDocs } from '../../common/swagger/docs';
import {
  initiateMultipartSchema,
  completeMultipartSchema,
  InitiateMultipartInput,
  CompleteMultipartInput,
  Permission,
} from '@storage/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Upload')
@ApiBearerAuth()
@Controller('buckets/:bucket/upload')
@UseGuards(PermissionsGuard, BucketAccessGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @UseInterceptors(FileInterceptor('file'))
  @DocumentedEndpoint(UploadDocs.simple)
  upload(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
    @UploadedFile() file: Express.Multer.File,
    @User() user: AuthenticatedUser,
  ) {
    return this.uploadService.uploadSimple(bucket, key, file.buffer, file.mimetype, user);
  }

  @Post('multipart/initiate')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(UploadDocs.initiateMultipart)
  initiate(
    @Param('bucket') bucket: string,
    @Body(new ZodValidationPipe(initiateMultipartSchema)) body: InitiateMultipartInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.uploadService.initiateMultipart(bucket, body, user);
  }

  @Post('multipart/:uploadId/parts')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @UseInterceptors(FileInterceptor('file'))
  @DocumentedEndpoint(UploadDocs.uploadPart)
  uploadPart(
    @Param('bucket') bucket: string,
    @Param('uploadId') uploadId: string,
    @Query('key') key: string,
    @Query('partNumber') partNumber: number,
    @UploadedFile() file: Express.Multer.File,
    @User() user: AuthenticatedUser,
  ) {
    return this.uploadService.uploadPart(bucket, key, uploadId, partNumber, file.buffer, user);
  }

  @Post('multipart/complete')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(UploadDocs.completeMultipart)
  complete(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
    @Body(new ZodValidationPipe(completeMultipartSchema)) body: CompleteMultipartInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.uploadService.completeMultipart(bucket, key, body, user);
  }

  @Delete('multipart/:uploadId')
  @RequirePermissions(Permission.OBJECTS_WRITE)
  @DocumentedEndpoint(UploadDocs.abortMultipart)
  abort(
    @Param('bucket') bucket: string,
    @Param('uploadId') uploadId: string,
    @Query('key') key: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.uploadService.abortMultipart(bucket, key, uploadId, user);
  }

  @Get('multipart/:uploadId/parts')
  @RequirePermissions(Permission.OBJECTS_READ)
  @DocumentedEndpoint(UploadDocs.listParts)
  listParts(
    @Param('bucket') bucket: string,
    @Param('uploadId') uploadId: string,
    @Query('key') key: string,
    @User() user: AuthenticatedUser,
  ) {
    return this.uploadService.listParts(bucket, key, uploadId, user);
  }
}
