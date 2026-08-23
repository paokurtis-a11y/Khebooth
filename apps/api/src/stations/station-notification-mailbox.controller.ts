import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import type { AuthenticatedStation } from './station-auth.types';
import { CurrentStation } from './current-station.decorator';
import { StationAuthGuard } from './station-auth.guard';
import { StationNotificationsService } from './station-notifications.service';

@Controller('stations/notification-mailbox')
@UseGuards(StationAuthGuard)
export class StationNotificationMailboxController {
  constructor(private readonly notifications: StationNotificationsService) {}

  @Get()
  list(@CurrentStation() station: AuthenticatedStation) {
    return this.notifications.list(station);
  }

  @Patch(':id')
  update(
    @CurrentStation() station: AuthenticatedStation,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.notifications.update(station, id, body.action);
  }
}
