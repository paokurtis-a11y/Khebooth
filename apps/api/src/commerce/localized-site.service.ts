import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketPricingService, SUPPORTED_MARKET_CURRENCIES, type MarketCurrency, type MarketRegion } from './market-pricing.service';

type PlanRow={id:string;organizationId:string;code:string;name:string;tagline:string;priceMonthlyChf:number|null;localizedPrices:unknown;features:unknown;active:boolean;highlighted:boolean;stripePriceId:string|null;sortOrder:number};
type SiteRow={organizationId:string;heroTitle:string;heroSubtitle:string;primaryCta:string;appDownloadUrl:string|null;supportEmail:string|null;latestVersion:string;releaseNotes:string;maintenanceActive:boolean;maintenanceMessage:string|null;paymentMethods:unknown;faq:unknown;regionalSettings:unknown;media:unknown;seo:unknown;socialLinks:unknown;announcement:unknown;contentBlocks:unknown};
type RegionPolicy={enabled:boolean;showPrices:boolean;showDownload:boolean;showReviews:boolean;showPromoVideo:boolean;forceCurrency?:MarketCurrency;heroTitle?:string;heroSubtitle?:string;primaryCta?:string;announcement?:string};

const DEFAULT_REGION_POLICY:RegionPolicy={enabled:true,showPrices:true,showDownload:true,showReviews:true,showPromoVideo:true};
const REGION_KEYS:MarketRegion[]=['SWITZERLAND','EUROZONE','AFRICA','ASIA','AMERICAS','OTHER'];

function objectOrEmpty(value:unknown):Record<string,unknown>{return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function arrayOrEmpty(value:unknown):unknown[]{return Array.isArray(value)?value:[];}

@Injectable()
export class LocalizedSiteService{
  constructor(private readonly prisma:PrismaService,private readonly marketPricing:MarketPricingService){}
  private async org(){const rows=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1`;if(!rows[0])throw new ServiceUnavailableException('KHE Booth organization is not initialized');return rows[0].id;}
  private policy(settings:unknown,region:MarketRegion):RegionPolicy{
    if(!settings||typeof settings!=='object'||Array.isArray(settings))return DEFAULT_REGION_POLICY;
    const raw=(settings as Record<string,unknown>)[region];if(!raw||typeof raw!=='object'||Array.isArray(raw))return DEFAULT_REGION_POLICY;
    const value=raw as Record<string,unknown>;const requested=String(value.forceCurrency??'').toUpperCase();
    return{enabled:value.enabled!==false,showPrices:value.showPrices!==false,showDownload:value.showDownload!==false,showReviews:value.showReviews!==false,showPromoVideo:value.showPromoVideo!==false,forceCurrency:SUPPORTED_MARKET_CURRENCIES.includes(requested as MarketCurrency)?requested as MarketCurrency:undefined,heroTitle:typeof value.heroTitle==='string'&&value.heroTitle.trim()?value.heroTitle.trim():undefined,heroSubtitle:typeof value.heroSubtitle==='string'&&value.heroSubtitle.trim()?value.heroSubtitle.trim():undefined,primaryCta:typeof value.primaryCta==='string'&&value.primaryCta.trim()?value.primaryCta.trim():undefined,announcement:typeof value.announcement==='string'&&value.announcement.trim()?value.announcement.trim():undefined};
  }
  async publicSite(country?:string|null,currency?:string|null){
    const organizationId=await this.org();const baseMarket=this.marketPricing.market(country,currency);
    const configs=await this.prisma.$queryRaw<SiteRow[]>`SELECT "organizationId","heroTitle","heroSubtitle","primaryCta","appDownloadUrl","supportEmail","latestVersion","releaseNotes","maintenanceActive","maintenanceMessage","paymentMethods","faq","regionalSettings",media,seo,"socialLinks",announcement,"contentBlocks" FROM "MarketingSiteConfig" WHERE "organizationId"=${organizationId}::uuid LIMIT 1`;
    const config=configs[0];const regionPolicy=this.policy(config?.regionalSettings,baseMarket.region);const market=this.marketPricing.market(country,currency||regionPolicy.forceCurrency);
    const plans=await this.prisma.$queryRaw<PlanRow[]>`SELECT id,"organizationId",code,name,tagline,"priceMonthlyChf","localizedPrices",features,active,highlighted,"stripePriceId","sortOrder" FROM "SubscriptionPlanConfig" WHERE "organizationId"=${organizationId}::uuid AND active=TRUE ORDER BY "sortOrder" ASC,name ASC`;
    return{
      ...config,
      media:objectOrEmpty(config?.media),seo:objectOrEmpty(config?.seo),socialLinks:objectOrEmpty(config?.socialLinks),announcement:objectOrEmpty(config?.announcement),contentBlocks:arrayOrEmpty(config?.contentBlocks),
      heroTitle:regionPolicy.heroTitle||config?.heroTitle,
      heroSubtitle:regionPolicy.heroSubtitle||config?.heroSubtitle,
      primaryCta:regionPolicy.primaryCta||config?.primaryCta,
      market,regionPolicy,supportedCurrencies:SUPPORTED_MARKET_CURRENCIES,
      plans:plans.map((p)=>({...p,currency:market.currency,priceMonthlyCents:this.marketPricing.localizedAmount(p.priceMonthlyChf,p.localizedPrices,market.currency)})),
    };
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
  normalizeRegionalSettings(value:unknown){const source=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};const output:Record<string,RegionPolicy>={};for(const region of REGION_KEYS)output[region]=this.policy(source,region);return output;}
}
