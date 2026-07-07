import { Global, Module } from '@nestjs/common';
import { StorageEventsService } from './storage-events.service';
import { ProjectQuotasModule } from '../project-quotas/project-quotas.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Global()
@Module({
  imports: [ProjectQuotasModule, WebhooksModule],
  providers: [StorageEventsService],
  exports: [StorageEventsService, ProjectQuotasModule, WebhooksModule],
})
export class StorageEventsModule {}
