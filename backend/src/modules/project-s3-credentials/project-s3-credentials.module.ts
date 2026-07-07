import { Module } from '@nestjs/common';
import { ProjectS3CredentialsService } from './project-s3-credentials.service';

@Module({
  providers: [ProjectS3CredentialsService],
  exports: [ProjectS3CredentialsService],
})
export class ProjectS3CredentialsModule {}
