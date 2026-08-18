import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ClientAccessRow={id:string;organizationId:string;name:string;email:string|null;kheCode:string|null;paymentStatus:string;subscriptionStatus:string;subscriptionPlan:string;billingCustomerId:string|null};
type ReviewRow={id:string;rating:number;title:string|null;body:string;displayName:string;verifiedSubscriber:boolean;createdAt:Date;updatedAt:Date};

@Injectable()
export class CustomerAccessService{
  constructor(private readonly prisma:PrismaService){}

  private async authenticate(email:string,kheCode:string):Promise<ClientAccessRow>{
    const normalized=email.trim().toLowerCase();const code=kheCode.trim().toUpperCase();
    if(!normalized.includes('@')||!/^KHE-[A-F0-9]{10}$/.test(code))throw new UnauthorizedException('Identifiants KHE invalides');
    const rows=await this.prisma.$queryRaw<ClientAccessRow[]>`
      SELECT id,"organizationId",name,email,"kheCode","paymentStatus","subscriptionStatus","subscriptionPlan","billingCustomerId"
      FROM "Client" WHERE lower(email)=${normalized} AND "kheCode"=${code} LIMIT 1
    `;
    if(!rows[0])throw new UnauthorizedException('Identifiants KHE invalides');return rows[0];
  }

  async portal(payload:Record<string,unknown>){
    const client=await this.authenticate(String(payload.email??''),String(payload.kheCode??''));
    if(!client.billingCustomerId)throw new BadRequestException('Aucun abonnement récurrent gérable en ligne pour ce compte.');
    const secret=process.env.STRIPE_SECRET_KEY?.trim();if(!secret)throw new ServiceUnavailableException('La gestion de facturation n’est pas encore configurée.');
    const webOrigin=(process.env.WEB_ORIGIN||'https://khebooth-rdvo.vercel.app').split(',')[0].trim().replace(/\/$/,'');
    const params=new URLSearchParams({customer:client.billingCustomerId,return_url:`${webOrigin}/account/subscription`});
    const response=await fetch('https://api.stripe.com/v1/billing_portal/sessions',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});
    const data=await response.json() as {url?:string;error?:{message?:string}};if(!response.ok||!data.url)throw new ServiceUnavailableException(data.error?.message||'Portail de facturation indisponible');
    return {url:data.url};
  }

  async account(payload:Record<string,unknown>){
    const client=await this.authenticate(String(payload.email??''),String(payload.kheCode??''));
    return {name:client.name,email:client.email,kheCode:client.kheCode,subscriptionPlan:client.subscriptionPlan,subscriptionStatus:client.subscriptionStatus,paymentStatus:client.paymentStatus,renewalManagedByStripe:Boolean(client.billingCustomerId)};
  }

  async submitReview(payload:Record<string,unknown>){
    const client=await this.authenticate(String(payload.email??''),String(payload.kheCode??''));
    if(client.paymentStatus!=='PAID'||!['ACTIVE','CANCELLED'].includes(client.subscriptionStatus))throw new UnauthorizedException('Les avis sont réservés aux abonnés KHE Booth ayant effectué un paiement vérifié.');
    const rating=Math.trunc(Number(payload.rating??0));const body=String(payload.body??'').trim();const title=payload.title?String(payload.title).trim():null;const displayName=(String(payload.displayName??'').trim()||client.name).slice(0,80);
    if(rating<1||rating>5||body.length<10||body.length>2000)throw new BadRequestException('Note ou avis invalide.');
    const rows=await this.prisma.$queryRaw<ReviewRow[]>`
      INSERT INTO "PublicReview" (id,"organizationId","clientId",rating,title,body,"displayName",active,"verifiedSubscriber","createdAt","updatedAt")
      VALUES(gen_random_uuid(),${client.organizationId}::uuid,${client.id}::uuid,${rating},${title},${body},${displayName},TRUE,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT ("clientId") DO UPDATE SET rating=EXCLUDED.rating,title=EXCLUDED.title,body=EXCLUDED.body,"displayName"=EXCLUDED."displayName",active=TRUE,"updatedAt"=CURRENT_TIMESTAMP
      RETURNING id,rating,title,body,"displayName","verifiedSubscriber","createdAt","updatedAt"
    `;
    return rows[0];
  }

  async publicReviews(){
    const org=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1`;
    if(!org[0])return [];
    return this.prisma.$queryRaw<ReviewRow[]>`
      SELECT id,rating,title,body,"displayName","verifiedSubscriber","createdAt","updatedAt"
      FROM "PublicReview" WHERE "organizationId"=${org[0].id}::uuid AND active=TRUE ORDER BY "createdAt" DESC LIMIT 24
    `;
  }
}
