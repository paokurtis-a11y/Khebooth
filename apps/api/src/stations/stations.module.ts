import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { MediaSharingService } from './media-sharing.service';
import { MediaStorageService } from './media-storage.service';
import { PublicMediaController } from './public-media.controller';
import { StationAuthGuard } from './station-auth.guard';
import { StationProfileService } from './station-profile.service';
import { StationRenewalService } from './station-renewal.service';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [StationsController, PublicMediaController],
  providers: [StationsService, StationRenewalService, StationProfileService, MediaStorageService, MediaSharingService, StationAuthGuard],
})
export class StationsModule {}
