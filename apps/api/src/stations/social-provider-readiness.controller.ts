import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedStation } from './station-auth.types';
import { CurrentStation } from './current-station.decorator';
import { SharingBusinessService } from './sharing-business.service';
import { SocialProviderConnectionV2Service } from './social-provider-connection-v2.service';
import type { KheSocialProvider } from './social-provider-readiness';
import { StationAuthGuard } from './station-auth.guard';

const PROVIDERS = new Set<KheSocialProvider>(['WHATSAPP','TIKTOK','FACEBOOK','INSTAGRAM','X','TELEGRAM','YOUTUBE']);
@Controller('stations/social')
export class SocialProviderReadinessController {
  constructor(private readonly sharingBusiness: SharingBusinessService, private readonly connections: SocialProviderConnectionV2Service) {}
  private provider(value:string):KheSocialProvider{const provider=String(value??'').toUpperCase() as KheSocialProvider;if(!PROVIDERS.has(provider))throw new BadRequestException('Réseau social KHE inconnu');return provider;}
  @UseGuards(StationAuthGuard) @Get('readiness') async readiness(@CurrentStation() station:AuthenticatedStation){const settings=await this.sharingBusiness.settings(station);return{generatedAt:new Date(),providers:await this.connections.readiness(station,settings.socialLinks)};}
  @UseGuards(StationAuthGuard) @Post('oauth/:provider/start') start(@CurrentStation() station:AuthenticatedStation,@Param('provider') provider:string){return this.connections.startOAuth(station,this.provider(provider));}
  @Get('oauth/:provider/callback') callback(@Param('provider') provider:string,@Query('code') code?:string,@Query('state') state?:string,@Query('error') error?:string,@Query('error_description') errorDescription?:string){if(error)throw new BadRequestException(`Autorisation refusée par le fournisseur : ${errorDescription||error}`);return this.connections.oauthCallback(this.provider(provider),String(code??''),String(state??''));}
  @UseGuards(StationAuthGuard) @Post('oauth/:provider/select') select(@CurrentStation() station:AuthenticatedStation,@Param('provider') provider:string,@Body() body:{accountId?:string}){if(!body?.accountId)throw new BadRequestException('Compte Meta à sélectionner');return this.connections.selectAccount(station,this.provider(provider),body.accountId);}
  @UseGuards(StationAuthGuard) @Post(':provider/validate') validate(@CurrentStation() station:AuthenticatedStation,@Param('provider') provider:string){return this.connections.validateServerProvider(station,this.provider(provider));}
  @UseGuards(StationAuthGuard) @Post(':provider/disconnect') disconnect(@CurrentStation() station:AuthenticatedStation,@Param('provider') provider:string){return this.connections.disconnect(station,this.provider(provider));}
}
