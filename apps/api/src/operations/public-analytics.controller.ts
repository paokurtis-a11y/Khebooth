import { BadRequestException, Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const EVENTS=new Set(['SESSION_STARTED','SESSION_HEARTBEAT','SESSION_ENDED','PAGE_VIEW','PLAN_VIEW','PLAN_SELECTED','CHECKOUT_STARTED','CHECKOUT_COMPLETED','APP_DOWNLOAD','MESSAGE_OPENED','CTA_CLICKED']);
function decoded(value:unknown){if(typeof value!=='string'||!value)return null;try{return decodeURIComponent(value).slice(0,160);}catch{return value.slice(0,160);}}
function finite(value:unknown){const n=Number(value);return Number.isFinite(n)?n:null;}

@Controller('operations/public')
export class PublicAnalyticsController{
  constructor(private readonly prisma:PrismaService){}

  @Post('track')
  async track(@Body() body:Record<string,unknown>,@Req() request:Request){
    if(body.consent!==true)return{tracked:false,reason:'consent_required'};
    const eventType=String(body.eventType??'').trim().toUpperCase();if(!EVENTS.has(eventType))throw new BadRequestException('Unsupported analytics event');
    const orgs=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "Organization" WHERE COALESCE("tenantKind",'KHE_ROOT')='KHE_ROOT' ORDER BY "createdAt" ASC LIMIT 1`;
    const organizationId=orgs[0]?.id;if(!organizationId)throw new BadRequestException('Organization not initialized');
    await this.prisma.$executeRaw`INSERT INTO "GrowthStrategyConfig" ("organizationId") VALUES (${organizationId}::uuid) ON CONFLICT ("organizationId") DO NOTHING`;
    const configs=await this.prisma.$queryRaw<Array<{anonymousAnalyticsEnabled:boolean}>>`SELECT "anonymousAnalyticsEnabled" FROM "GrowthStrategyConfig" WHERE "organizationId"=${organizationId}::uuid LIMIT 1`;
    if(configs[0]?.anonymousAnalyticsEnabled===false)return{tracked:false,reason:'analytics_disabled'};
    const anonymousId=String(body.anonymousId??'').trim().slice(0,120);const sessionId=String(body.sessionId??'').trim().slice(0,120);if(anonymousId.length<8||sessionId.length<8)throw new BadRequestException('Invalid analytics identity');
    const planCode=body.planCode?String(body.planCode).trim().toUpperCase().slice(0,40):null;const value=finite(body.valueCents);const metadata=body.metadata&&typeof body.metadata==='object'&&!Array.isArray(body.metadata)?body.metadata:{};
    const countryCode=decoded(request.headers['x-vercel-ip-country']);const regionCode=decoded(request.headers['x-vercel-ip-country-region']);const municipality=decoded(request.headers['x-vercel-ip-city']);const timezone=decoded(request.headers['x-vercel-ip-timezone']);const latitude=finite(request.headers['x-vercel-ip-latitude']);const longitude=finite(request.headers['x-vercel-ip-longitude']);
    await this.prisma.$executeRaw`
      INSERT INTO "MarketingAnalyticsEvent" (id,"organizationId","anonymousId","sessionId","eventType","planCode","valueCents",metadata,consent,"countryCode","regionCode",municipality,latitude,longitude,timezone,"createdAt")
      VALUES (gen_random_uuid(),${organizationId}::uuid,${anonymousId},${sessionId},${eventType},${planCode},${value===null?null:Math.round(value)},${JSON.stringify(metadata)}::jsonb,TRUE,${countryCode},${regionCode},${municipality},${latitude},${longitude},${timezone},CURRENT_TIMESTAMP)
    `;
    return{tracked:true};
  }
}
