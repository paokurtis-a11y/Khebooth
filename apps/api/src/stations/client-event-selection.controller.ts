import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ClientEventWorkspaceService } from './client-event-workspace.service';
import { CurrentStation } from './current-station.decorator';
import { StationAuthGuard } from './station-auth.guard';
import type { AuthenticatedStation } from './station-auth.types';

@Controller('stations/client-events')
export class ClientEventSelectionController {
  constructor(private readonly clientEvents: ClientEventWorkspaceService) {}

  @UseGuards(StationAuthGuard)
  @Post(':id/select')
  select(@CurrentStation() station: AuthenticatedStation, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.clientEvents.selectEvent(station, id);
  }
}
