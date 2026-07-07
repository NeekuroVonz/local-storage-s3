import { Global, Module } from '@nestjs/common';
import { GarageAdminService } from './garage-admin.service';
import { EncryptionService } from '../../common/services/encryption.service';

@Global()
@Module({
  providers: [GarageAdminService, EncryptionService],
  exports: [GarageAdminService, EncryptionService],
})
export class GarageModule {}
