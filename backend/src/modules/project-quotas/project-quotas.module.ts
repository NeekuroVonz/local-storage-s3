import { Module } from '@nestjs/common';
import { ProjectQuotasService } from './project-quotas.service';

@Module({
  providers: [ProjectQuotasService],
  exports: [ProjectQuotasService],
})
export class ProjectQuotasModule {}
