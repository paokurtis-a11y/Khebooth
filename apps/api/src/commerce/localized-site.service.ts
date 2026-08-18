import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketPricingService, SUPPORTED_MARKET_CURRENCIES } from './market-pricing.service';

type PlanRow={id:string;organizationId:string;code:string;name:string;tagline:string;priceMonthlyChf:number|null;localizedPrices:unknown;features:unknown;active:boolean;highlighted:boolean;stripePriceId:string|null;sortOrder:number};
type SiteRow={organizationId:string;heroTitle:string;heroSubtitle:string;primaryCta:string;appDownloadUrl:string|null;supportEmail:string|null;latestVersion:string;releaseNotes:string;maintenanceActive:boolean;maintenanceMessage:string|null;paymentMethods:unknown;faq:unknown};

@Injectable()
export class LocalizedSiteService{
  constructor(private readonly prisma:PrismaService,private readonly marketPricing:MarketPricingService){}
  private async org(){const rows=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1`;if(!rows[0])throw new ServiceUnavailableException('KHE Booth organization is not initialized');return rows[0].id;}
  async publicSite(country?:string|null,currency?:string|null){
    const organizationId=await this.org();const market=this.marketPricing.market(country,currency);
    const configs=await this.prisma.$queryRaw<SiteRow[]>`SELECT "organizationId","heroTitle","heroSubtitle","primaryCta","appDownloadUrl","supportEmail","latestVersion","releaseNotes","maintenanceActive","maintenanceMessage","paymentMethods","faq" FROM "MarketingSiteConfig" WHERE "organizationId"=${organizationId}::uuid LIMIT 1`;
    const plans=await this.prisma.$queryRaw<PlanRow[]>`SELECT id,"organizationId",code,name,tagline,"priceMonthlyChf","localizedPrices",features,active,highlighted,"stripePriceId","sortOrder" FROM "SubscriptionPlanConfig" WHERE "organizationId"=${organizationId}::uuid AND active=TRUE ORDER BY "sortOrder" ASC,name ASC`;
    return {...configs[0],market,supportedCurrencies:SUPPORTED_MARKET_CURRENCIES,plans:plans.map((p)=>({...p,currency:market.currency,priceMonthlyCents:this.marketPricing.localizedAmount(p.priceMonthlyChf,p.localizedPrices,market.currency)}))};
  }
  async updateLocalizedPrices(organizationId:string,code:string,payload:Record<string,unknown>){
    const values=payload.localizedPrices&&typeof payload.localizedPrices==='object'&&!Array.isArray(payload.localizedPrices)?payload.localizedPrices as Record<string,unknown>:{};
    const cleaned:Record<string,number>={};for(const currency of SUPPORTED_MARKET_CURRENCIES){if(currency==='CHF')continue;const raw=values[currency];if(raw===undefined||raw===null||raw==='')continue;const amount=Number(raw);if(!Number.isInteger(amount)||amount<0)throw new BadRequestException(`Invalid ${currency} price`);cleaned[currency]=amount;}
    const rows=await this.prisma.$queryRaw<Array<{stripePriceId:string|null}>>`UPDATE "SubscriptionPlanConfig" SET "localizedPrices"=${JSON.stringify(cleaned)}::jsonb,"updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=${organizationId}::uuid AND code=${code} RETURNING "stripePriceId"`;
    if(!rows[0])throw new BadRequestException('Unknown subscription plan');
    const secret=process.env.STRIPE_SECRET_KEY?.trim();const stripePriceId=rows[0].stripePriceId;
    if(secret&&stripePriceId){const params=new URLSearchParams();for(const [currency,amount] of Object.entries(cleaned))params.set(`currency_options[${currency.toLowerCase()}][unit_amount]`,String(amount));if([...params.keys()].length){const response=await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(stripePriceId)}`,{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});if(!response.ok){const data=await response.json() as {error?:{message?:string}};throw new ServiceUnavailableException(data.error?.message||'Stripe localized pricing synchronization failed');}}}
    return{code,localizedPrices:cleaned,stripeSynchronized:Boolean(secret&&stripePriceId)};
  }
}
