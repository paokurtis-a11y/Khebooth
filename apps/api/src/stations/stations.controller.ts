import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CommerceService } from '../commerce/commerce.service';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import type { AuthenticatedStation } from './station-auth.types';
import { CurrentStation } from './current-station.decorator';
import { CreateClientEventDto } from './dto/create-client-event.dto';
import { CreateMediaDto } from './dto/create-media.dto';
import { RedeemStationDto } from './dto/redeem-station.dto';
import { UpdateStationCommandDto } from './dto/update-station-command.dto';
import { UpdateStationProfileDto } from './dto/update-station-profile.dto';
import { UpdateStationStatusDto } from './dto/update-station-status.dto';
import { UpdateUploadProgressDto } from './dto/update-upload-progress.dto';
import { ClientEventWorkspaceService } from './client-event-workspace.service';
import { DesignStorageService } from './design-storage.service';
import { MediaSharingService } from './media-sharing.service';
import { MediaStorageService } from './media-storage.service';
import { StationAuthGuard } from './station-auth.guard';
import { StationConnectionService } from './station-connection.service';
import { StationProfileService } from './station-profile.service';
import { StationRenewalService } from './station-renewal.service';
import { StationsService } from './stations.service';

@Controller('stations')
export class StationsController {
  constructor(
    private readonly stations: StationsService,
    private readonly mediaStorage: MediaStorageService,
    private readonly mediaSharing: MediaSharingService,
    private readonly designStorage: DesignStorageService,
    private readonly stationRenewal: StationRenewalService,
    private readonly stationProfile: StationProfileService,
    private readonly stationConnection: StationConnectionService,
    private readonly commerce: CommerceService,
    private readonly entitlements: EntitlementsService,
    private readonly clientEvents: ClientEventWorkspaceService,
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
  @Get('client-workspace') clientWorkspace(@CurrentStation() station:AuthenticatedStation){ return this.clientEvents.workspace(station); }

  @UseGuards(StationAuthGuard)
  @Post('client-events') createClientEvent(@CurrentStation() station:AuthenticatedStation,@Body() dto:CreateClientEventDto){ return this.clientEvents.createEvent(station,dto); }

  @UseGuards(StationAuthGuard)
  @Post('client-events/:id/design-ready') markClientEventDesignReady(@CurrentStation() station:AuthenticatedStation,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){ return this.clientEvents.markDesignReady(station,id,body); }

  @UseGuards(StationAuthGuard)
  @Post('client-events/:id/design-background-upload') async prepareDesignBackground(@CurrentStation() station:AuthenticatedStation,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){
    await this.entitlements.requireStation(station,'STUDIO_BASIC');
    return this.designStorage.prepareBackgroundUpload(station,id,body);
  }

  @UseGuards(StationAuthGuard)
  @Post('design-background-download') designBackgroundDownload(@CurrentStation() station:AuthenticatedStation,@Body() body:Record<string,unknown>){
    return this.designStorage.backgroundDownload(station,body);
  }

  @UseGuards(StationAuthGuard)
  @Post('client-events/:id/switch') switchClientEvent(@CurrentStation() station:AuthenticatedStation,@Param('id',new ParseUUIDPipe()) id:string){ return this.clientEvents.switchEvent(station,id); }

  @UseGuards(StationAuthGuard)
  @Get('client-experience') clientExperience(@CurrentStation() station: AuthenticatedStation) { return this.commerce.stationClientExperience(station); }

  @UseGuards(StationAuthGuard)
  @Get('entitlements') entitlementsForStation(@CurrentStation() station: AuthenticatedStation) { return this.entitlements.forStation(station); }

  @UseGuards(StationAuthGuard)
  @Get('manifest') async manifest(@CurrentStation() station: AuthenticatedStation) { const [manifest,subscriptionAccess]=await Promise.all([this.stations.manifest(station),this.entitlements.forStation(station)]);return{...manifest,subscriptionAccess}; }

  @UseGuards(StationAuthGuard)
  @Get('live-session') async liveSession(@CurrentStation() station: AuthenticatedStation) {
    await this.entitlements.requireStation(station, 'SHARING');
    await this.stationConnection.requireAccepted(station);
    return this.stations.liveSession(station);
  }
  @UseGuards(StationAuthGuard)
  @Get('control') async control(@CurrentStation() station: AuthenticatedStation) {
    await this.entitlements.requireStation(station, 'SHARING');
    return this.stationConnection.decorate(station, await this.stations.getControl(station));
  }
  @UseGuards(StationAuthGuard)
  @Post('control/connection-request') async requestControlConnection(@CurrentStation() station: AuthenticatedStation) {
    await this.entitlements.requireStation(station, 'SHARING');
    return this.stationConnection.request(station);
  }
  @UseGuards(StationAuthGuard)
  @Patch('control/connection-response') async respondControlConnection(@CurrentStation() station: AuthenticatedStation, @Body() body: Record<string, unknown>) {
    await this.entitlements.requireStation(station, 'SHARING');
    return this.stationConnection.respond(station, body.accepted);
  }
  @UseGuards(StationAuthGuard)
  @Post('control/disconnect') async disconnectControlConnection(@CurrentStation() station: AuthenticatedStation) {
    await this.entitlements.requireStation(station, 'SHARING');
    return this.stationConnection.disconnect(station);
  }
  @UseGuards(StationAuthGuard)
  @Patch('control/command') async updateControlCommand(@CurrentStation() station: AuthenticatedStation, @Body() dto: UpdateStationCommandDto) {
    await this.entitlements.requireStation(station, 'SHARING');
    await this.stationConnection.requireAccepted(station);
    return this.stationConnection.decorate(station, await this.stations.updateControlCommand(station, dto));
  }
  @UseGuards(StationAuthGuard)
  @Patch('control/status') async updateControlStatus(@CurrentStation() station: AuthenticatedStation, @Body() dto: UpdateStationStatusDto) {
    await this.entitlements.requireStation(station, 'SHARING');
    return this.stationConnection.decorate(station, await this.stations.updateControlStatus(station, dto));
  }
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
