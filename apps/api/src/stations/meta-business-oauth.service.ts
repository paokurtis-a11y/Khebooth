import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';
import { SocialDeveloperCredentialService } from './social-developer-credential.service';

type MetaProvider='FACEBOOK'|'INSTAGRAM';

@Injectable()
export class MetaBusinessOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly developer: SocialDeveloperCredentialService,
  ) {}

  private hash(value:string){return createHash('sha256').update(value).digest('hex');}
  private graphVersion(){return process.env.META_GRAPH_API_VERSION?.trim()||'v26.0';}
  private callbackOrigin(){const explicit=process.env.SOCIAL_OAUTH_CALLBACK_ORIGIN?.trim();if(explicit)return explicit.replace(/\/$/,'');const vercel=process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();if(vercel)return`https://${vercel.replace(/^https?:\/\//,'').replace(/\/$/,'')}`;return'http://localhost:3001';}
  private callbackUrl(provider:MetaProvider){return`${this.callbackOrigin()}/api/stations/social/oauth/${provider.toLowerCase()}/callback`;}

  async start(station:AuthenticatedStation,provider:MetaProvider){
    if(provider!=='FACEBOOK'&&provider!=='INSTAGRAM')throw new BadRequestException('Fournisseur Meta invalide');
    const [appId,configId]=await Promise.all([
      this.developer.value(station.organizationId,'META','appId','META_APP_ID'),
      this.developer.value(station.organizationId,'META','configId','META_BUSINESS_LOGIN_CONFIG_ID'),
    ]);
    const state=randomBytes(32).toString('base64url');
    await this.prisma.$executeRaw`DELETE FROM "SocialOAuthState" WHERE "expiresAt"<CURRENT_TIMESTAMP OR ("consumedAt" IS NOT NULL AND "createdAt"<CURRENT_TIMESTAMP-INTERVAL '1 hour')`;
    await this.prisma.$executeRaw`INSERT INTO "SocialOAuthState" ("organizationId","stationSessionId",provider,"stateHash","codeVerifierCiphertext","expiresAt") VALUES (${station.organizationId}::uuid,${station.sessionId}::uuid,${provider},${this.hash(state)},NULL,CURRENT_TIMESTAMP+INTERVAL '10 minutes')`;
    await this.prisma.$executeRaw`INSERT INTO "SocialProviderConnection" ("organizationId",provider,status,"lastError") VALUES (${station.organizationId}::uuid,${provider},'AUTHORIZING',NULL) ON CONFLICT ("organizationId",provider) DO UPDATE SET status='AUTHORIZING',"lastError"=NULL,"updatedAt"=CURRENT_TIMESTAMP`;
    const redirectUri=this.callbackUrl(provider);
    const url=new URL(`https://www.facebook.com/${this.graphVersion()}/dialog/oauth`);
    url.search=new URLSearchParams({
      client_id:appId,
      redirect_uri:redirectUri,
      config_id:configId,
      response_type:'code',
      override_default_response_type:'true',
      state,
    }).toString();
    return{provider,authorizationUrl:url.toString(),callbackUrl:redirectUri,expiresInSeconds:600};
  }
}
