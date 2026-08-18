import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingService } from '../marketing/marketing.service';
import { MarketPricingService } from './market-pricing.service';

type PlanRow={organizationId:string;code:string;name:string;priceMonthlyChf:number|null;localizedPrices:unknown;stripePriceId:string|null;active:boolean};
type ClientRow={id:string;organizationId:string;email:string|null;kheCode:string|null;billingCustomerId:string|null};
type CampaignRow={id:string;planCode:string|null;discountPercent:number;segment:string;name:string};

@Injectable()
export class PromotionCheckoutService{
  constructor(private readonly prisma:PrismaService,private readonly marketing:MarketingService,private readonly marketPricing:MarketPricingService){}

  private code(){return `KHE-${randomBytes(5).toString('hex').toUpperCase()}`;}
  private async org(){const rows=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1`;if(!rows[0])throw new ServiceUnavailableException('KHE Booth organization is not initialized');return rows[0].id;}
  private async client(organizationId:string,email:string,name?:string):Promise<ClientRow>{
    const rows=await this.prisma.$queryRaw<ClientRow[]>`SELECT id,"organizationId",email,"kheCode","billingCustomerId" FROM "Client" WHERE "organizationId"=${organizationId}::uuid AND lower(email)=${email} LIMIT 1`;
    if(rows[0])return rows[0];
    const display=(name?.trim()||email.split('@')[0]||'Client KHE').slice(0,160);const code=this.code();
    const created=await this.prisma.$queryRaw<ClientRow[]>`INSERT INTO "Client"(id,"organizationId",name,email,"kheCode","marketingEmailsEnabled","createdAt","updatedAt") VALUES(gen_random_uuid(),${organizationId}::uuid,${display},${email},${code},FALSE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id,"organizationId",email,"kheCode","billingCustomerId"`;
    return created[0];
  }
  private async plan(organizationId:string,code:string):Promise<PlanRow>{const rows=await this.prisma.$queryRaw<PlanRow[]>`SELECT "organizationId",code,name,"priceMonthlyChf","localizedPrices","stripePriceId",active FROM "SubscriptionPlanConfig" WHERE "organizationId"=${organizationId}::uuid AND code=${code} AND active=TRUE LIMIT 1`;if(!rows[0])throw new BadRequestException('Unknown subscription plan');return rows[0];}
  private async promotion(organizationId:string,planCode:string):Promise<CampaignRow|null>{
    await this.marketing.evaluateAutomation(organizationId);
    const rows=await this.prisma.$queryRaw<CampaignRow[]>`SELECT id,"planCode","discountPercent",segment,name FROM "MarketingCampaign" WHERE "organizationId"=${organizationId}::uuid AND active=TRUE AND "startsAt"<=CURRENT_TIMESTAMP AND "endsAt">CURRENT_TIMESTAMP AND ("planCode" IS NULL OR "planCode"=${planCode}) AND segment='ALL' ORDER BY automatic ASC,"discountPercent" DESC,"createdAt" DESC LIMIT 1`;
    return rows[0]??null;
  }

  async checkout(payload:Record<string,unknown>,detectedCountry?:string){
    const organizationId=await this.org();const email=String(payload.email??'').trim().toLowerCase();const name=payload.name?String(payload.name):undefined;const planCode=String(payload.planCode??'').trim().toUpperCase();const paymentMethod=String(payload.paymentMethod??'card').trim().toLowerCase();const marketingOptIn=payload.marketingOptIn===true;const autoRenewAcknowledged=payload.autoRenewAcknowledged===true;
    if(!email.includes('@'))throw new BadRequestException('A valid email is required');
    const plan=await this.plan(organizationId,planCode);const client=await this.client(organizationId,email,name);
    await this.prisma.$executeRaw`UPDATE "Client" SET "marketingEmailsEnabled"=${marketingOptIn},"updatedAt"=CURRENT_TIMESTAMP WHERE id=${client.id}::uuid`;
    if(plan.priceMonthlyChf===null)return{requiresContact:true,message:'Cette offre nécessite une configuration sur mesure.'};
    if(plan.priceMonthlyChf===0){await this.prisma.$executeRaw`UPDATE "Client" SET "subscriptionPlan"=${plan.code},"subscriptionStatus"='ACTIVE',"paymentStatus"='PAID',"subscriptionStartedAt"=COALESCE("subscriptionStartedAt",CURRENT_TIMESTAMP),"updatedAt"=CURRENT_TIMESTAMP WHERE id=${client.id}::uuid`;await this.marketing.trackServer(organizationId,'CHECKOUT_COMPLETED',client.id,plan.code,0,{free:true});return{free:true,clientId:client.id,kheCode:client.kheCode};}
    const isTwint=paymentMethod==='twint';if(!isTwint&&!autoRenewAcknowledged)throw new BadRequestException('Vous devez confirmer le renouvellement automatique avant de poursuivre.');
    const market=this.marketPricing.market(detectedCountry,payload.currency?String(payload.currency):undefined);const checkoutMarket=isTwint?this.marketPricing.market(detectedCountry,'CHF'):market;
    const localizedBase=this.marketPricing.localizedAmount(plan.priceMonthlyChf,plan.localizedPrices,checkoutMarket.currency);if(localizedBase===null)throw new BadRequestException('Localized plan price is unavailable');
    const campaign=await this.promotion(organizationId,plan.code);const discount=campaign?.discountPercent??0;const amount=Math.max(0,Math.round(localizedBase*(100-discount)/100));
    const secret=process.env.STRIPE_SECRET_KEY?.trim();if(!secret)throw new ServiceUnavailableException('Online payments are not configured yet');
    const webOrigin=(process.env.WEB_ORIGIN||'https://khebooth-rdvo.vercel.app').split(',')[0].trim().replace(/\/$/,'');const params=new URLSearchParams();
    params.set('success_url',`${webOrigin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`);params.set('cancel_url',`${webOrigin}/subscribe?plan=${encodeURIComponent(plan.code)}&currency=${checkoutMarket.currency}`);params.set('customer_email',email);params.set('metadata[clientId]',client.id);params.set('metadata[planCode]',plan.code);params.set('metadata[paymentMethod]',paymentMethod);params.set('metadata[amountCents]',String(amount));params.set('metadata[currency]',checkoutMarket.currency);if(campaign)params.set('metadata[campaignId]',campaign.id);params.set('line_items[0][quantity]','1');
    const canUseStoredPrice=!isTwint&&discount===0&&Boolean(plan.stripePriceId);
    if(canUseStoredPrice){params.set('line_items[0][price]',plan.stripePriceId!);params.set('currency',checkoutMarket.currency.toLowerCase());}
    else{params.set('line_items[0][price_data][currency]',checkoutMarket.currency.toLowerCase());params.set('line_items[0][price_data][unit_amount]',String(amount));params.set('line_items[0][price_data][product_data][name]',`KHE Booth ${plan.name}${discount?` · Offre -${discount}%`:''}`);}
    if(isTwint){params.set('mode','payment');params.append('payment_method_types[]','twint');params.set('metadata[billingMode]','twint_manual_renewal');}else{params.set('mode','subscription');params.append('payment_method_types[]','card');if(!canUseStoredPrice)params.set('line_items[0][price_data][recurring][interval]','month');params.set('subscription_data[metadata][clientId]',client.id);params.set('subscription_data[metadata][planCode]',plan.code);params.set('subscription_data[metadata][amountCents]',String(amount));params.set('subscription_data[metadata][currency]',checkoutMarket.currency);if(campaign)params.set('subscription_data[metadata][campaignId]',campaign.id);}
    const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});const data=await response.json() as{id?:string;url?:string;error?:{message?:string}};if(!response.ok||!data.url)throw new ServiceUnavailableException(data.error?.message||'Unable to start secure checkout');
    await this.prisma.$executeRaw`UPDATE "Client" SET "subscriptionPlan"=${plan.code},"subscriptionStatus"='PAYMENT_PENDING',"paymentStatus"='PENDING',"updatedAt"=CURRENT_TIMESTAMP WHERE id=${client.id}::uuid`;
    await this.marketing.trackServer(organizationId,'CHECKOUT_STARTED',client.id,plan.code,amount,{paymentMethod,campaignId:campaign?.id??null,discountPercent:discount,autoRenew:!isTwint,country:checkoutMarket.country,currency:checkoutMarket.currency});
    return{checkoutUrl:data.url,sessionId:data.id,discountPercent:discount,automaticRenewal:!isTwint,twintManualRenewal:isTwint,market:checkoutMarket};
  }
}
