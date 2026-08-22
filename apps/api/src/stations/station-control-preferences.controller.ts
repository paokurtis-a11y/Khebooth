import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import { CurrentStation } from './current-station.decorator';
import { StationAuthGuard } from './station-auth.guard';
import type { AuthenticatedStation } from './station-auth.types';
import { StationConnectionService } from './station-connection.service';
import { StationControlPreferencesService } from './station-control-preferences.service';

@Controller('stations/control/preferences')
export class StationControlPreferencesController {
  constructor(
    private readonly preferences: StationControlPreferencesService,
    private readonly entitlements: EntitlementsService,
    private readonly connection: StationConnectionService,
  ) {}

  @UseGuards(StationAuthGuard)
  @Get()
  async get(@CurrentStation() station: AuthenticatedStation) {
    await this.entitlements.requireStation(station, 'SHARING');
    return this.preferences.get(station);
  }

  @UseGuards(StationAuthGuard)
  @Patch()
  async updateFromSharing(@CurrentStation() station: AuthenticatedStation, @Body() body: Record<string, unknown>) {
    await this.entitlements.requireStation(station, 'SHARING');
    await this.connection.requireAccepted(station);
    return this.preferences.updateFromSharing(station, body);
  }

  @UseGuards(StationAuthGuard)
  @Patch('status')
  async updateFromCapture(@CurrentStation() station: AuthenticatedStation, @Body() body: Record<string, unknown>) {
    await this.entitlements.requireStation(station, 'SHARING');
    return this.preferences.updateFromCapture(station, body);
  }
}
