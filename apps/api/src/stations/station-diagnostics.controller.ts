import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedStation } from './station-auth.types';
import { CurrentStation } from './current-station.decorator';
import { StationAuthGuard } from './station-auth.guard';
import { StationDiagnosticsService } from './station-diagnostics.service';

@Controller('stations')
export class StationDiagnosticsController {
  constructor(private readonly diagnostics: StationDiagnosticsService) {}

  @UseGuards(StationAuthGuard)
  @Post('diagnostics')
  report(@CurrentStation() station: AuthenticatedStation, @Body() body: unknown) {
    return this.diagnostics.report(station, body);
  }
}
