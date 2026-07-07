import { Module, forwardRef } from '@nestjs/common';
import { OrganizationsController, ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { BucketsModule } from '../buckets/buckets.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { BucketGrantsModule } from '../bucket-grants/bucket-grants.module';
import { ProjectS3CredentialsModule } from '../project-s3-credentials/project-s3-credentials.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ProjectQuotasModule } from '../project-quotas/project-quotas.module';

@Module({
  imports: [
    forwardRef(() => BucketsModule),
    ApiKeysModule,
    BucketGrantsModule,
    ProjectS3CredentialsModule,
    WebhooksModule,
    ProjectQuotasModule,
  ],
  controllers: [OrganizationsController, ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
