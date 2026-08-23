import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedStation } from './station-auth.types';
import { CurrentStation } from './current-station.decorator';
import { StationAuthGuard } from './station-auth.guard';
import { StationReadinessReportService, type StationReadinessReportInput } from './station-readiness-report.service';

@Controller('stations')
export class StationReadinessReportController {
  constructor(private readonly reports: StationReadinessReportService) {}

  @UseGuards(StationAuthGuard)
  @Post('readiness-report')
  report(@CurrentStation() station: AuthenticatedStation, @Body() body: StationReadinessReportInput) {
    return this.reports.report(station, body ?? {});
  }
}
