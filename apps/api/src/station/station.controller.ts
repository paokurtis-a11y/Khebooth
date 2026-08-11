import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActivateStationDto } from './dto/activate-station.dto';
import { StationService } from './station.service';
import type { StationJwtPayload } from './station.types';

@Controller('station')
export class StationController {
  constructor(private readonly station: StationService) {}

  @Post('activate')
  activate(@Body() dto: ActivateStationDto) {
    return this.station.activate(dto.code);
  }

  @UseGuards(AuthGuard('station-jwt'))
  @Get('manifest')
  manifest(@Req() request: { user: StationJwtPayload }) {
    return this.station.manifest(request.user);
  }
}
