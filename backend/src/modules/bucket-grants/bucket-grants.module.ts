import { Module } from '@nestjs/common';
import { BucketGrantsService } from './bucket-grants.service';

@Module({
  providers: [BucketGrantsService],
  exports: [BucketGrantsService],
})
export class BucketGrantsModule {}
