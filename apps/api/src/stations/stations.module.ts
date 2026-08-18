import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommerceModule } from '../commerce/commerce.module';
import { EventsModule } from '../events/events.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ClientEventWorkspaceService } from './client-event-workspace.service';
import { MediaSharingService } from './media-sharing.service';
import { MediaStorageService } from './media-storage.service';
import { PublicMediaController } from './public-media.controller';
import { StationAuthGuard } from './station-auth.guard';
import { StationProfileService } from './station-profile.service';
import { StationRenewalService } from './station-renewal.service';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [AuthModule, EventsModule, CommerceModule, SubscriptionsModule],
  controllers: [StationsController, PublicMediaController],
  providers: [StationsService, StationRenewalService, StationProfileService, ClientEventWorkspaceService, MediaStorageService, MediaSharingService, StationAuthGuard],
})
export class StationsModule {}
