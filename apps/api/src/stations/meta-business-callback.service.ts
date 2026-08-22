import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SocialCredentialCipher } from './social-credential-cipher';
import { SocialDeveloperCredentialService } from './social-developer-credential.service';

type MetaProvider='FACEBOOK'|'INSTAGRAM';
type OAuthStateRow={organizationId:string};
type MetaPage={id:string;name?:string;access_token?:string;instagram_business_account?:{id:string}};
type MetaError={error?:{message?:string;type?:string;code?:number;error_subcode?:number}};

@Injectable()
export class MetaBusinessCallbackService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly cipher:SocialCredentialCipher,
    private readonly developer:SocialDeveloperCredentialService,
  ){}

  private hash(value:string){return createHash('sha256').update(value).digest('hex');}
  private graphVersion(){return process.env.META_GRAPH_API_VERSION?.trim()||'v26.0';}
  private callbackOrigin(){const explicit=process.env.SOCIAL_OAUTH_CALLBACK_ORIGIN?.trim();if(explicit)return explicit.replace(/\/$/,'');const vercel=process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();if(vercel)return`https://${vercel.replace(/^https?:\/\//,'').replace(/\/$/,'')}`;return'http://localhost:3001';}
  private callbackUrl(provider:MetaProvider){return`${this.callbackOrigin()}/api/stations/social/oauth/${provider.toLowerCase()}/callback`;}

  private async fetchMeta<T>(url:string,stage:string):Promise<T>{
    const response=await fetch(url);
    const text=await response.text();
    let parsed:unknown=null;
    if(text){try{parsed=JSON.parse(text);}catch{parsed=null;}}
    if(!response.ok){
      const error=(parsed as MetaError|null)?.error;
      const code=typeof error?.code==='number'?` code ${error.code}`:'';
      const subcode=typeof error?.error_subcode==='number'?`/${error.error_subcode}`:'';
      const detail=typeof error?.message==='string'?error.message.replace(/\s+/g,' ').slice(0,220):'réponse sans détail';
      throw new BadRequestException(`Meta — ${stage} refusé (${response.status}${code}${subcode}) : ${detail}`);
    }
    if(parsed===null)throw new BadRequestException(`Meta — ${stage} a renvoyé une réponse invalide`);
    return parsed as T;
  }

  private async saveError(organizationId:string,provider:MetaProvider,error:unknown){
    const message=error instanceof Error?error.message.slice(0,300):'OAuth Meta failed';
    await this.prisma.$executeRaw`INSERT INTO "SocialProviderConnection" ("organizationId",provider,status,"lastError") VALUES (${organizationId}::uuid,${provider},'ERROR',${message}) ON CONFLICT ("organizationId",provider) DO UPDATE SET status='ERROR',"lastError"=${message},"updatedAt"=CURRENT_TIMESTAMP`;
  }

  private async saveSelection(organizationId:string,provider:MetaProvider,token:string,expiresAt:Date|null,scopes:string[],candidates:Array<{pageId:string;pageName:string;instagramAccountId:string|null}>){
    const encrypted=this.cipher.encrypt(token);
    const metadata=JSON.stringify({candidates});
    await this.prisma.$executeRaw`INSERT INTO "SocialProviderConnection" ("organizationId",provider,status,"accessTokenCiphertext","tokenExpiresAt",scopes,metadata,"lastError") VALUES (${organizationId}::uuid,${provider},'SELECTION_REQUIRED',${encrypted},${expiresAt},${scopes}::text[],${metadata}::jsonb,NULL) ON CONFLICT ("organizationId",provider) DO UPDATE SET status='SELECTION_REQUIRED',"accessTokenCiphertext"=${encrypted},"tokenExpiresAt"=${expiresAt},scopes=${scopes}::text[],metadata=${metadata}::jsonb,"lastError"=NULL,"updatedAt"=CURRENT_TIMESTAMP`;
  }

  private async saveConnected(organizationId:string,provider:MetaProvider,page:MetaPage,scopes:string[]){
    if(!page.access_token)throw new NotFoundException('Meta n’a pas fourni de jeton pour la Page sélectionnée');
    if(provider==='FACEBOOK'){
      const encrypted=this.cipher.encrypt(page.access_token);
      const metadata=JSON.stringify({pageId:page.id});
      await this.prisma.$executeRaw`INSERT INTO "SocialProviderConnection" ("organizationId",provider,status,"externalAccountId","externalAccountName","accessTokenCiphertext","tokenExpiresAt",scopes,metadata,"connectedAt","lastValidatedAt","lastError") VALUES (${organizationId}::uuid,${provider},'CONNECTED',${page.id},${page.name??page.id},${encrypted},NULL,${scopes}::text[],${metadata}::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL) ON CONFLICT ("organizationId",provider) DO UPDATE SET status='CONNECTED',"externalAccountId"=${page.id},"externalAccountName"=${page.name??page.id},"accessTokenCiphertext"=${encrypted},"tokenExpiresAt"=NULL,scopes=${scopes}::text[],metadata=${metadata}::jsonb,"connectedAt"=COALESCE("connectedAt",CURRENT_TIMESTAMP),"lastValidatedAt"=CURRENT_TIMESTAMP,"lastError"=NULL,"updatedAt"=CURRENT_TIMESTAMP`;
      return{provider,status:'CONNECTED',externalAccountId:page.id,externalAccountName:page.name??page.id};
    }
    const instagramId=page.instagram_business_account?.id;
    if(!instagramId)throw new BadRequestException('Cette Page n’est pas liée à un compte Instagram professionnel');
    const identity=await this.fetchMeta<{id?:string;username?:string;name?:string}>(`https://graph.facebook.com/${this.graphVersion()}/${encodeURIComponent(instagramId)}?fields=id,username,name&access_token=${encodeURIComponent(page.access_token)}`,'lecture du compte Instagram');
    const externalId=identity.id??instagramId;
    const externalName=identity.username?`@${identity.username}`:identity.name??page.name??instagramId;
    const encrypted=this.cipher.encrypt(page.access_token);
    const metadata=JSON.stringify({pageId:page.id,instagramAccountId:instagramId});
    await this.prisma.$executeRaw`INSERT INTO "SocialProviderConnection" ("organizationId",provider,status,"externalAccountId","externalAccountName","accessTokenCiphertext","tokenExpiresAt",scopes,metadata,"connectedAt","lastValidatedAt","lastError") VALUES (${organizationId}::uuid,${provider},'CONNECTED',${externalId},${externalName},${encrypted},NULL,${scopes}::text[],${metadata}::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL) ON CONFLICT ("organizationId",provider) DO UPDATE SET status='CONNECTED',"externalAccountId"=${externalId},"externalAccountName"=${externalName},"accessTokenCiphertext"=${encrypted},"tokenExpiresAt"=NULL,scopes=${scopes}::text[],metadata=${metadata}::jsonb,"connectedAt"=COALESCE("connectedAt",CURRENT_TIMESTAMP),"lastValidatedAt"=CURRENT_TIMESTAMP,"lastError"=NULL,"updatedAt"=CURRENT_TIMESTAMP`;
    return{provider,status:'CONNECTED',externalAccountId:externalId,externalAccountName:externalName};
  }

  private async metaPages(token:string,provider:MetaProvider){
    const version=this.graphVersion();
    const fields=provider==='FACEBOOK'?'id,name,access_token,tasks':'id,name,access_token,tasks,instagram_business_account';
    const pages=await this.fetchMeta<{data?:MetaPage[]}>(`https://graph.facebook.com/${version}/me/accounts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,'lecture des Pages');
    const permissions=await this.fetchMeta<{data?:Array<{permission:string;status:string}>}>(`https://graph.facebook.com/${version}/me/permissions?access_token=${encodeURIComponent(token)}`,'lecture des permissions');
    return{pages:pages.data??[],scopes:(permissions.data??[]).filter(item=>item.status==='granted').map(item=>item.permission)};
  }

  private async finish(organizationId:string,provider:MetaProvider,code:string){
    const [appId,appSecret]=await Promise.all([
      this.developer.value(organizationId,'META','appId','META_APP_ID'),
      this.developer.value(organizationId,'META','appSecret','META_APP_SECRET'),
    ]);
    const exchangeParams=new URLSearchParams({client_id:appId,client_secret:appSecret,redirect_uri:this.callbackUrl(provider),code});
    const shortToken=await this.fetchMeta<{access_token?:string;expires_in?:number}>(`https://graph.facebook.com/${this.graphVersion()}/oauth/access_token?${exchangeParams}`,'échange du code OAuth');
    if(!shortToken.access_token)throw new BadRequestException('Meta n’a pas fourni de jeton utilisateur');
    const longParams=new URLSearchParams({grant_type:'fb_exchange_token',client_id:appId,client_secret:appSecret,fb_exchange_token:shortToken.access_token});
    const longToken=await this.fetchMeta<{access_token?:string;expires_in?:number}>(`https://graph.facebook.com/${this.graphVersion()}/oauth/access_token?${longParams}`,'échange du jeton longue durée');
    if(!longToken.access_token)throw new BadRequestException('Meta n’a pas fourni de jeton longue durée');
    const data=await this.metaPages(longToken.access_token,provider);
    const eligible=provider==='INSTAGRAM'?data.pages.filter(page=>page.instagram_business_account?.id):data.pages;
    if(!eligible.length)throw new BadRequestException(provider==='INSTAGRAM'?'Aucun compte Instagram professionnel partagé avec KHE Booth':'Aucune Page Facebook partagée avec KHE Booth');
    if(eligible.length===1)return this.saveConnected(organizationId,provider,eligible[0],data.scopes);
    const candidates=eligible.map(page=>({pageId:page.id,pageName:page.name??page.id,instagramAccountId:page.instagram_business_account?.id??null}));
    const expiresAt=longToken.expires_in?new Date(Date.now()+longToken.expires_in*1000):null;
    await this.saveSelection(organizationId,provider,longToken.access_token,expiresAt,data.scopes,candidates);
    return{provider,status:'SELECTION_REQUIRED',candidates};
  }

  async callback(provider:MetaProvider,code:string,state:string){
    if((provider!=='FACEBOOK'&&provider!=='INSTAGRAM')||!code||!state)throw new BadRequestException('Callback OAuth Meta incomplet');
    const rows=await this.prisma.$queryRaw<OAuthStateRow[]>`UPDATE "SocialOAuthState" SET "consumedAt"=CURRENT_TIMESTAMP WHERE "stateHash"=${this.hash(state)} AND provider=${provider} AND "consumedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP RETURNING "organizationId"`;
    const oauth=rows[0];
    if(!oauth)throw new BadRequestException('État OAuth Meta expiré ou déjà utilisé');
    try{return await this.finish(oauth.organizationId,provider,code);}catch(error){await this.saveError(oauth.organizationId,provider,error);throw error;}
  }
}
