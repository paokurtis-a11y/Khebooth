import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedStation } from './station-auth.types';
import { CurrentStation } from './current-station.decorator';
import { SharingBusinessService } from './sharing-business.service';
import { socialProviderReadiness } from './social-provider-readiness';
import { StationAuthGuard } from './station-auth.guard';

@Controller('stations/social')
export class SocialProviderReadinessController {
  constructor(private readonly sharingBusiness: SharingBusinessService) {}

  @UseGuards(StationAuthGuard)
  @Get('readiness')
  async readiness(@CurrentStation() station: AuthenticatedStation) {
    const settings = await this.sharingBusiness.settings(station);
    return {
      generatedAt: new Date(),
      providers: socialProviderReadiness(settings.socialLinks),
    };
  }
}
