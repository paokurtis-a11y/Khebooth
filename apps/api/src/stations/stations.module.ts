import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommerceModule } from '../commerce/commerce.module';
import { EventsModule } from '../events/events.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ClientEventWorkspaceService } from './client-event-workspace.service';
import { DesignStorageService } from './design-storage.service';
import { MediaSharingService } from './media-sharing.service';
import { MediaStorageService } from './media-storage.service';
import { ProfileStorageService } from './profile-storage.service';
import { PublicMediaController } from './public-media.controller';
import { PublicSocialController } from './public-social.controller';
import { SharingBusinessService } from './sharing-business.service';
import { StationAuthGuard } from './station-auth.guard';
import { StationConnectionService } from './station-connection.service';
import { StationProfileService } from './station-profile.service';
import { StationRenewalService } from './station-renewal.service';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [AuthModule, EventsModule, CommerceModule, SubscriptionsModule],
  controllers: [StationsController, PublicMediaController, PublicSocialController],
  providers: [StationsService, StationRenewalService, StationProfileService, ClientEventWorkspaceService, DesignStorageService, ProfileStorageService, MediaStorageService, MediaSharingService, SharingBusinessService, StationConnectionService, StationAuthGuard],
})
export class StationsModule {}
