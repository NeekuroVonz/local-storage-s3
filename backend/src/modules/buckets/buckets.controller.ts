import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BucketsService } from './buckets.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { User } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { BucketsDocs } from '../../common/swagger/docs';
import {
  createBucketSchema,
  updateBucketSchema,
  CreateBucketInput,
  UpdateBucketInput,
  Permission,
} from '@storage/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Buckets')
@ApiBearerAuth()
@Controller('buckets')
@UseGuards(PermissionsGuard)
export class BucketsController {
  constructor(private readonly bucketsService: BucketsService) {}

  @Get()
  @RequirePermissions(Permission.BUCKETS_READ)
  @DocumentedEndpoint(BucketsDocs.list)
  findAll(@User() user: AuthenticatedUser, @Query('search') search?: string) {
    return this.bucketsService.findAll(user, search);
  }

  @Get(':name')
  @RequirePermissions(Permission.BUCKETS_READ)
  @DocumentedEndpoint(BucketsDocs.getOne)
  findOne(@Param('name') name: string, @User() user: AuthenticatedUser) {
    return this.bucketsService.findOne(name, user);
  }

  @Post()
  @RequirePermissions(Permission.BUCKETS_WRITE)
  @DocumentedEndpoint(BucketsDocs.create)
  create(
    @Body(new ZodValidationPipe(createBucketSchema)) body: CreateBucketInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.bucketsService.create(body, user.id, user);
  }

  @Patch(':name')
  @RequirePermissions(Permission.BUCKETS_WRITE)
  @DocumentedEndpoint(BucketsDocs.update)
  update(
    @Param('name') name: string,
    @Body(new ZodValidationPipe(updateBucketSchema)) body: UpdateBucketInput,
    @User() user: AuthenticatedUser,
  ) {
    return this.bucketsService.update(name, body, user.id, user);
  }

  @Delete(':name')
  @RequirePermissions(Permission.BUCKETS_DELETE)
  @DocumentedEndpoint(BucketsDocs.remove)
  remove(@Param('name') name: string, @User() user: AuthenticatedUser) {
    return this.bucketsService.remove(name, user.id, user);
  }
}
