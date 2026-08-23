import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedStation } from './station-auth.types';
import { CurrentStation } from './current-station.decorator';
import { StationAuthGuard } from './station-auth.guard';
import { StationLockRecoveryService } from './station-lock-recovery.service';

@UseGuards(StationAuthGuard)
@Controller('stations/security/lock-recovery')
export class StationLockRecoveryController{
  constructor(private readonly recovery:StationLockRecoveryService){}
  @Post('request') request(@CurrentStation() station:AuthenticatedStation){return this.recovery.request(station);}
  @Post('verify') verify(@CurrentStation() station:AuthenticatedStation,@Body() body:Record<string,unknown>){return this.recovery.verify(station,{code:body.code,token:body.token});}
}
