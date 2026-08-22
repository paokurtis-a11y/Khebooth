import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import { CurrentStation } from './current-station.decorator';
import { EventSharingService } from './event-sharing.service';
import { StationAuthGuard } from './station-auth.guard';
import type { AuthenticatedStation } from './station-auth.types';

@Controller('stations/event-share')
export class EventSharingController{
  constructor(private readonly sharing:EventSharingService,private readonly entitlements:EntitlementsService){}
  @UseGuards(StationAuthGuard) @Post() async create(@CurrentStation() station:AuthenticatedStation){await this.entitlements.requireStation(station,'GUEST_QR');return this.sharing.create(station);}
  @UseGuards(StationAuthGuard) @Post(':id/revoke') async revoke(@CurrentStation() station:AuthenticatedStation,@Param('id',new ParseUUIDPipe()) id:string){await this.entitlements.requireStation(station,'GUEST_QR');return this.sharing.revoke(station,id);}
}
