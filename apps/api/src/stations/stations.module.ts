import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommerceModule } from '../commerce/commerce.module';
import { EventsModule } from '../events/events.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ClientEventWorkspaceService } from './client-event-workspace.service';
import { DesignStorageService } from './design-storage.service';
import { MediaCatalogService } from './media-catalog.service';
import { MediaSharingService } from './media-sharing.service';
import { MediaStorageService } from './media-storage.service';
import { MediaTrashService } from './media-trash.service';
import { ProfileStorageService } from './profile-storage.service';
import { PublicMediaController } from './public-media.controller';
import { PublicSocialController } from './public-social.controller';
import { SharingBusinessService } from './sharing-business.service';
import { SocialCredentialCipher } from './social-credential-cipher';
import { SocialDeveloperCredentialController } from './social-developer-credential.controller';
import { SocialDeveloperCredentialService } from './social-developer-credential.service';
import { SocialProviderConnectionV2Service } from './social-provider-connection-v2.service';
import { SocialProviderReadinessController } from './social-provider-readiness.controller';
import { StationAuthGuard } from './station-auth.guard';
import { StationBillingController } from './station-billing.controller';
import { StationBillingService } from './station-billing.service';
import { StationConnectionService } from './station-connection.service';
import { StationNotificationsService } from './station-notifications.service';
import { StationProfileService } from './station-profile.service';
import { StationRenewalService } from './station-renewal.service';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [AuthModule, EventsModule, CommerceModule, SubscriptionsModule],
  controllers: [StationsController, StationBillingController, PublicMediaController, PublicSocialController, SocialProviderReadinessController, SocialDeveloperCredentialController],
  providers: [StationsService, StationRenewalService, StationProfileService, StationNotificationsService, StationBillingService, ClientEventWorkspaceService, DesignStorageService, ProfileStorageService, MediaStorageService, MediaCatalogService, MediaSharingService, MediaTrashService, SharingBusinessService, StationConnectionService, StationAuthGuard, SocialCredentialCipher, SocialDeveloperCredentialService, SocialProviderConnectionV2Service],
})
export class StationsModule {}
