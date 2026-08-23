import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { StationNotificationsService } from './station-notifications.service';

@Controller('stations/system/notification-trash')
export class StationNotificationMaintenanceController {
  constructor(private readonly notifications: StationNotificationsService) {}

  @Get('purge')
  purge(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || authorization !== `Bearer ${secret}`) throw new UnauthorizedException('Invalid cron authorization');
    return this.notifications.purgeAllExpiredTrash();
  }
}
