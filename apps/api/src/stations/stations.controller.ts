import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CommerceService } from '../commerce/commerce.service';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import type { AuthenticatedStation } from './station-auth.types';
import { CurrentStation } from './current-station.decorator';
import { CreateMediaDto } from './dto/create-media.dto';
import { RedeemStationDto } from './dto/redeem-station.dto';
import { UpdateStationCommandDto } from './dto/update-station-command.dto';
import { UpdateStationProfileDto } from './dto/update-station-profile.dto';
import { UpdateStationStatusDto } from './dto/update-station-status.dto';
import { UpdateUploadProgressDto } from './dto/update-upload-progress.dto';
import { MediaSharingService } from './media-sharing.service';
import { MediaStorageService } from './media-storage.service';
import { StationAuthGuard } from './station-auth.guard';
import { StationProfileService } from './station-profile.service';
import { StationRenewalService } from './station-renewal.service';
import { StationsService } from './stations.service';

@Controller('stations')
export class StationsController {
  constructor(
    private readonly stations: StationsService,
    private readonly mediaStorage: MediaStorageService,
    private readonly mediaSharing: MediaSharingService,
    private readonly stationRenewal: StationRenewalService,
    private readonly stationProfile: StationProfileService,
    private readonly commerce: CommerceService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Post('redeem') redeem(@Body() dto: RedeemStationDto) { return this.stations.redeem(dto); }
  @Post('renew') renew(@Headers('authorization') authorization?: string) { return this.stationRenewal.renew(authorization); }

  @UseGuards(StationAuthGuard)
  @Get('profile') profile(@CurrentStation() station: AuthenticatedStation) { return this.stationProfile.get(station); }

  @UseGuards(StationAuthGuard)
  @Patch('profile') updateProfile(@CurrentStation() station: AuthenticatedStation, @Body() dto: UpdateStationProfileDto) { return this.stationProfile.update(station, dto); }

  @UseGuards(StationAuthGuard)
  @Get('notification-preferences') notificationPreferences(@CurrentStation() station:AuthenticatedStation){ return this.stationProfile.notificationPreferences(station); }

  @UseGuards(StationAuthGuard)
  @Patch('notification-preferences') updateNotificationPreferences(@CurrentStation() station:AuthenticatedStation,@Body() body:Record<string,unknown>){ return this.stationProfile.updateNotificationPreferences(station,body); }

  @UseGuards(StationAuthGuard)
  @Get('client-experience') clientExperience(@CurrentStation() station: AuthenticatedStation) { return this.commerce.stationClientExperience(station); }

  @UseGuards(StationAuthGuard)
  @Get('entitlements') entitlementsForStation(@CurrentStation() station: AuthenticatedStation) { return this.entitlements.forStation(station); }

  @UseGuards(StationAuthGuard)
  @Get('manifest') async manifest(@CurrentStation() station: AuthenticatedStation) { const [manifest,subscriptionAccess]=await Promise.all([this.stations.manifest(station),this.entitlements.forStation(station)]);return{...manifest,subscriptionAccess}; }

  @UseGuards(StationAuthGuard)
  @Get('live-session') async liveSession(@CurrentStation() station: AuthenticatedStation) { await this.entitlements.requireStation(station, 'SHARING'); return this.stations.liveSession(station); }
  @UseGuards(StationAuthGuard)
  @Get('control') async control(@CurrentStation() station: AuthenticatedStation) { await this.entitlements.requireStation(station, 'SHARING'); return this.stations.getControl(station); }
  @UseGuards(StationAuthGuard)
  @Patch('control/command') async updateControlCommand(@CurrentStation() station: AuthenticatedStation, @Body() dto: UpdateStationCommandDto) { await this.entitlements.requireStation(station, 'SHARING'); return this.stations.updateControlCommand(station, dto); }
  @UseGuards(StationAuthGuard)
  @Patch('control/status') async updateControlStatus(@CurrentStation() station: AuthenticatedStation, @Body() dto: UpdateStationStatusDto) { await this.entitlements.requireStation(station, 'SHARING'); return this.stations.updateControlStatus(station, dto); }
  @UseGuards(StationAuthGuard)
  @Get('media') async listMedia(@CurrentStation() station: AuthenticatedStation) { await this.entitlements.requireStation(station, 'CLOUD_SYNC'); return this.stations.listMedia(station); }
  @UseGuards(StationAuthGuard)
  @Post('media') async createMedia(@CurrentStation() station: AuthenticatedStation, @Body() dto: CreateMediaDto) { await this.entitlements.requireStation(station, 'CLOUD_SYNC'); return this.stations.createMedia(station, dto); }
  @UseGuards(StationAuthGuard)
  @Post('media/:id/blob-upload') async prepareBlobUpload(@CurrentStation() station: AuthenticatedStation, @Param('id', new ParseUUIDPipe()) id: string) { await this.entitlements.requireStation(station, 'CLOUD_SYNC'); return this.mediaStorage.prepareUpload(station, id); }
  @UseGuards(StationAuthGuard)
  @Get('media/:id/download') async mediaDownload(@CurrentStation() station: AuthenticatedStation, @Param('id', new ParseUUIDPipe()) id: string) { await this.entitlements.requireStation(station, 'CLOUD_SYNC'); return this.mediaStorage.downloadTicket(station, id); }
  @UseGuards(StationAuthGuard)
  @Post('media/:id/share') async createMediaShare(@CurrentStation() station: AuthenticatedStation, @Param('id', new ParseUUIDPipe()) id: string) { await this.entitlements.requireStation(station, 'GUEST_QR'); return this.mediaSharing.createShare(station, id); }
  @UseGuards(StationAuthGuard)
  @Post('shares/:id/revoke') async revokeMediaShare(@CurrentStation() station: AuthenticatedStation, @Param('id', new ParseUUIDPipe()) id: string) { await this.entitlements.requireStation(station, 'GUEST_QR'); return this.mediaSharing.revokeShare(station, id); }
  @UseGuards(StationAuthGuard)
  @Post('media/:id/upload') async initializeUpload(@CurrentStation() station: AuthenticatedStation, @Param('id', new ParseUUIDPipe()) id: string) { await this.entitlements.requireStation(station, 'CLOUD_SYNC'); return this.stations.initializeUpload(station, id); }
  @UseGuards(StationAuthGuard)
  @Patch('media/:id/upload') async updateUploadProgress(@CurrentStation() station: AuthenticatedStation, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUploadProgressDto) { await this.entitlements.requireStation(station, 'CLOUD_SYNC'); return this.stations.updateUploadProgress(station, id, dto); }
  @UseGuards(StationAuthGuard)
  @Post('media/:id/finalize') async finalizeUpload(@CurrentStation() station: AuthenticatedStation, @Param('id', new ParseUUIDPipe()) id: string) { await this.entitlements.requireStation(station, 'CLOUD_SYNC'); return this.mediaStorage.finalizeUpload(station, id); }
}
