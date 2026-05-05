import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { RequestWithUser } from '../common/types/request-with-user';
import { CreateAdminNotificationDto } from './dto/create-admin-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listMyNotifications(@Req() req: RequestWithUser, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.listMyNotifications(req.user.sub, query);
  }

  @Get('unread-count')
  unreadCount(@Req() req: RequestWithUser) {
    return this.notificationsService.unreadCount(req.user.sub);
  }

  @Patch('read-all')
  markAllAsRead(@Req() req: RequestWithUser) {
    return this.notificationsService.markAllAsRead(req.user.sub);
  }

  @Patch(':id/read')
  markAsRead(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.notificationsService.markAsRead(req.user.sub, id);
  }

  @Post('device-token')
  registerDeviceToken(@Req() req: RequestWithUser, @Body() payload: RegisterDeviceTokenDto) {
    return this.notificationsService.registerDeviceToken(req.user.sub, payload);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('broadcast')
  createAdminBroadcast(@Req() req: RequestWithUser, @Body() payload: CreateAdminNotificationDto) {
    return this.notificationsService.createAdminBroadcast(req.user.sub, payload);
  }
}
