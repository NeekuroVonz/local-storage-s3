import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/auth.decorators';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { SettingsDocs } from '../../common/swagger/docs';
import { Permission } from '@storage/shared';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @DocumentedEndpoint(SettingsDocs.getAll)
  getAll() {
    return this.settingsService.getAll();
  }

  @Get(':key')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @DocumentedEndpoint(SettingsDocs.getOne)
  async get(@Param('key') key: string) {
    const value = await this.settingsService.get(key);
    return { success: true, data: { key, value } };
  }

  @Put(':key')
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  @DocumentedEndpoint(SettingsDocs.set)
  set(@Param('key') key: string, @Body() body: { value: unknown }) {
    return this.settingsService.set(key, body.value);
  }
}
