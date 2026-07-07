import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { User } from '../../common/decorators/user.decorator';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { NotificationsDocs } from '../../common/swagger/docs';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @DocumentedEndpoint(NotificationsDocs.list)
  findAll(@User() user: AuthenticatedUser, @Query('unreadOnly') unreadOnly?: boolean) {
    return this.notificationsService.findAll(user.id, unreadOnly);
  }

  @Get('unread-count')
  @DocumentedEndpoint(NotificationsDocs.unreadCount)
  async unreadCount(@User() user: AuthenticatedUser) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { success: true, data: { count } };
  }

  @Patch(':id/read')
  @DocumentedEndpoint(NotificationsDocs.markAsRead)
  markAsRead(@User() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Patch('read-all')
  @DocumentedEndpoint(NotificationsDocs.markAllAsRead)
  markAllAsRead(@User() user: AuthenticatedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
