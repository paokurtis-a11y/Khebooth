import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { SharingBusinessService } from './sharing-business.service';

@Controller('public/social')
export class PublicSocialController {
  constructor(private readonly sharingBusiness: SharingBusinessService) {}

  @Get(':token')
  resolve(@Param('token') token: string) {
    return this.sharingBusiness.resolvePublicSocial(token);
  }

  @Patch(':token/consent')
  consent(@Param('token') token: string, @Body() body: Record<string, unknown>) {
    return this.sharingBusiness.updatePublicConsent(token, body);
  }
}
