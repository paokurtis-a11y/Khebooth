import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const INVITE_TTL_MS=30*24*60*60*1000;
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');

@Injectable()
export class EnterprisePaymentOnboardingService{
  constructor(private readonly prisma:PrismaService){}

  async handlePaidCheckout(object:any){
    const clientId=String(object?.metadata?.clientId??'').trim();
    const planCode=String(object?.metadata?.planCode??'').trim().toUpperCase();
    if(!clientId||planCode!=='ENTERPRISE'||String(object?.payment_status??'')!=='paid')return{handled:false};
    const clients=await this.prisma.$queryRaw<Array<{id:string;organizationId:string;email:string|null;name:string;paymentStatus:string;subscriptionPlan:string}>>`
      SELECT id,"organizationId",email,name,"paymentStatus","subscriptionPlan" FROM "Client" WHERE id=${clientId}::uuid LIMIT 1`;
    const client=clients[0];
    if(!client||client.paymentStatus!=='PAID'||client.subscriptionPlan!=='ENTERPRISE'||!client.email)return{handled:false};

    const onboardings=await this.prisma.$queryRaw<Array<{id:string;status:string}>>`
      SELECT id,status FROM "EnterpriseOnboarding" WHERE "clientId"=${client.id}::uuid LIMIT 1`;
    if(!onboardings[0])return{handled:false,reason:'onboarding-not-initialized'};
    if(['APPROVED','REJECTED'].includes(onboardings[0].status))return{handled:false,reason:'onboarding-closed'};

    const active=await this.prisma.$queryRaw<Array<{id:string;expiresAt:Date}>>`
      SELECT id,"expiresAt" FROM "EnterpriseOnboardingToken" WHERE "clientId"=${client.id}::uuid AND "revokedAt" IS NULL AND "expiresAt">CURRENT_TIMESTAMP ORDER BY "createdAt" DESC LIMIT 1`;
    if(active[0])return{handled:true,duplicate:true};

    const raw=randomBytes(32).toString('base64url');const expiresAt=new Date(Date.now()+INVITE_TTL_MS);
    await this.prisma.$executeRaw`
      INSERT INTO "EnterpriseOnboardingToken" (id,"organizationId","clientId","tokenHash","expiresAt") VALUES (gen_random_uuid(),${client.organizationId}::uuid,${client.id}::uuid,${hash(raw)},${expiresAt})`;
    const origin=(process.env.WEB_ORIGIN||'https://khebooth.vercel.app').split(',')[0].trim().replace(/\/$/,'');
    const url=`${origin}/enterprise/onboarding/${raw}`;
    await this.send(client.email,client.name,url);
    await this.prisma.auditLog.create({data:{organizationId:client.organizationId,userId:null,action:'ENTERPRISE_ONBOARDING_AUTO_INVITED',entityType:'Client',entityId:client.id,metadata:{provider:'stripe',expiresAt}}});
    return{handled:true,sent:true,expiresAt};
  }

  private async send(to:string,name:string,url:string){
    const key=process.env.RESEND_API_KEY?.trim();const from=process.env.KHE_EMAIL_FROM?.trim();if(!key||!from)return;
    await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:'Votre formulaire Enterprise KHE BOOTH est disponible',html:`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2 style="color:#b58a27">KHE BOOTH Enterprise</h2><p>Bonjour ${name},</p><p>Votre paiement Enterprise a été validé. Pour des raisons de sécurité, votre accès à la plateforme reste fermé jusqu’à la fin du contrôle d’identité.</p><p>Complétez le formulaire adapté à votre pays, puis transmettez une pièce d’identité ou un passeport valable ainsi qu’une preuve de domicile.</p><p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none">Compléter mon dossier Enterprise</a></p><p style="font-size:12px;color:#666">Lien personnel temporaire. Le dossier sera vérifié par un agent KHE et l’accès final restera sous contrôle du OWNER KHE BOOTH.</p></div>`})});
  }
}
