import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedStation } from './station-auth.types';
import { CurrentStation } from './current-station.decorator';
import { StationAuthGuard } from './station-auth.guard';
import { StationBillingService } from './station-billing.service';

@Controller('stations')
export class StationBillingController{
  constructor(private readonly billing:StationBillingService){}

  @UseGuards(StationAuthGuard)
  @Get('billing')
  billingDocuments(@CurrentStation() station:AuthenticatedStation){return this.billing.get(station);}
}
