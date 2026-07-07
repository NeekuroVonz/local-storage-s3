import { Global, Module } from '@nestjs/common';
import { BucketAccessService } from '../../common/services/bucket-access.service';
import { BucketAccessGuard } from '../../common/guards/bucket-access.guard';
import { JwtOnlyGuard } from '../../common/guards/jwt-only.guard';
import { ApiKeysModule } from '../../modules/api-keys/api-keys.module';

@Global()
@Module({
  imports: [ApiKeysModule],
  providers: [BucketAccessService, BucketAccessGuard, JwtOnlyGuard],
  exports: [BucketAccessService, BucketAccessGuard, JwtOnlyGuard, ApiKeysModule],
})
export class TenancyModule {}
