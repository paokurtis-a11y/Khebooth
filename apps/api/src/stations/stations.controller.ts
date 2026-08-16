import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedStation } from './station-auth.types';
import { CurrentStation } from './current-station.decorator';
import { CreateMediaDto } from './dto/create-media.dto';
import { RedeemStationDto } from './dto/redeem-station.dto';
import { UpdateStationCommandDto } from './dto/update-station-command.dto';
import { UpdateStationStatusDto } from './dto/update-station-status.dto';
import { UpdateUploadProgressDto } from './dto/update-upload-progress.dto';
import { MediaStorageService } from './media-storage.service';
import { StationAuthGuard } from './station-auth.guard';
import { StationsService } from './stations.service';

@Controller('stations')
export class StationsController {
  constructor(
    private readonly stations: StationsService,
    private readonly mediaStorage: MediaStorageService,
  ) {}

  @Post('redeem')
  redeem(@Body() dto: RedeemStationDto) {
    return this.stations.redeem(dto);
  }

  @UseGuards(StationAuthGuard)
  @Get('manifest')
  manifest(@CurrentStation() station: AuthenticatedStation) {
    return this.stations.manifest(station);
  }

  // LiveKit credentials stay server-side; stations only receive a scoped participant token.
  @UseGuards(StationAuthGuard)
  @Get('live-session')
  liveSession(@CurrentStation() station: AuthenticatedStation) {
    return this.stations.liveSession(station);
  }

  @UseGuards(StationAuthGuard)
  @Get('control')
  control(@CurrentStation() station: AuthenticatedStation) {
    return this.stations.getControl(station);
  }

  @UseGuards(StationAuthGuard)
  @Patch('control/command')
  updateControlCommand(
    @CurrentStation() station: AuthenticatedStation,
    @Body() dto: UpdateStationCommandDto,
  ) {
    return this.stations.updateControlCommand(station, dto);
  }

  @UseGuards(StationAuthGuard)
  @Patch('control/status')
  updateControlStatus(
    @CurrentStation() station: AuthenticatedStation,
    @Body() dto: UpdateStationStatusDto,
  ) {
    return this.stations.updateControlStatus(station, dto);
  }

  @UseGuards(StationAuthGuard)
  @Get('media')
  listMedia(@CurrentStation() station: AuthenticatedStation) {
    return this.stations.listMedia(station);
  }

  @UseGuards(StationAuthGuard)
  @Post('media')
  createMedia(@CurrentStation() station: AuthenticatedStation, @Body() dto: CreateMediaDto) {
    return this.stations.createMedia(station, dto);
  }

  @UseGuards(StationAuthGuard)
  @Post('media/:id/blob-upload')
  prepareBlobUpload(
    @CurrentStation() station: AuthenticatedStation,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.mediaStorage.prepareUpload(station, id);
  }

  @UseGuards(StationAuthGuard)
  @Get('media/:id/download')
  mediaDownload(
    @CurrentStation() station: AuthenticatedStation,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.mediaStorage.downloadTicket(station, id);
  }

  // Legacy progress endpoint remains useful for UI progress and operational telemetry.
  @UseGuards(StationAuthGuard)
  @Post('media/:id/upload')
  initializeUpload(
    @CurrentStation() station: AuthenticatedStation,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.stations.initializeUpload(station, id);
  }

  @UseGuards(StationAuthGuard)
  @Patch('media/:id/upload')
  updateUploadProgress(
    @CurrentStation() station: AuthenticatedStation,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUploadProgressDto,
  ) {
    return this.stations.updateUploadProgress(station, id, dto);
  }

  // Finalization now checks the real Blob object before marking a media asset SYNCED.
  @UseGuards(StationAuthGuard)
  @Post('media/:id/finalize')
  finalizeUpload(
    @CurrentStation() station: AuthenticatedStation,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.mediaStorage.finalizeUpload(station, id);
  }
}
