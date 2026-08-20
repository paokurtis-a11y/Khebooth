import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnterprisePaymentOnboardingService } from './enterprise-payment-onboarding.service';

type ExpiringClient={id:string;organizationId:string;name:string;email:string|null;subscriptionPlan:string;subscriptionEndsAt:Date|null};

@Injectable()
export class SubscriptionLifecycleService{
  constructor(private readonly prisma:PrismaService,private readonly enterpriseOnboarding:EnterprisePaymentOnboardingService){}

  async process(secret:string|undefined){
    const expected=process.env.CRON_SECRET?.trim();if(!expected||secret!==expected)throw new UnauthorizedException('Invalid cron authorization');
    const expired=await this.expirePaidAccess();
    const invitations=await this.enterpriseOnboarding.ensurePendingInvitations();
    return{ok:true,expired,invitations};
  }

  private async expirePaidAccess(){
    const clients=await this.prisma.$queryRaw<ExpiringClient[]>`
      SELECT id,"organizationId",name,email,"subscriptionPlan","subscriptionEndsAt"
      FROM "Client"
      WHERE "subscriptionPlan"<>'DISCOVERY'
        AND (
          ("subscriptionEndsAt" IS NOT NULL AND "subscriptionEndsAt"<=CURRENT_TIMESTAMP)
          OR "subscriptionStatus" IN ('CANCELLED','EXPIRED')
        )
      ORDER BY COALESCE("subscriptionEndsAt","updatedAt") ASC
      LIMIT 200`;
    let downgraded=0;
    for(const client of clients){
      const previousPlan=client.subscriptionPlan;
      await this.prisma.$transaction(async tx=>{
        await tx.$executeRaw`
          UPDATE "Client"
          SET "subscriptionPlan"='DISCOVERY',"subscriptionStatus"='EXPIRED',"paymentStatus"='UNPAID',"updatedAt"=CURRENT_TIMESTAMP
          WHERE id=${client.id}::uuid AND "subscriptionPlan"<>'DISCOVERY'`;
        await tx.$executeRaw`
          UPDATE "User" SET "isActive"=FALSE,"authVersion"="authVersion"+1,"updatedAt"=CURRENT_TIMESTAMP
          WHERE "managedClientId"=${client.id}::uuid AND "isActive"=TRUE`;
        await tx.$executeRaw`
          UPDATE "StationSession" s SET "revokedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP
          FROM "Event" e WHERE s."eventId"=e.id AND e."clientId"=${client.id}::uuid AND s."revokedAt" IS NULL`;
        await tx.$executeRaw`
          INSERT INTO "ClientMessage" (id,"organizationId","clientId",kind,title,body,"actionUrl","emailRequested")
          VALUES (gen_random_uuid(),${client.organizationId}::uuid,${client.id}::uuid,'SUBSCRIPTION','Votre abonnement est arrivé à échéance',
          ${`Votre abonnement ${previousPlan} est terminé. Votre compte est revenu automatiquement à l’accès gratuit KHE Booth. Vous pouvez renouveler à tout moment pour retrouver vos avantages.`},'/subscribe',FALSE)`;
        await tx.auditLog.create({data:{organizationId:client.organizationId,userId:null,action:'SUBSCRIPTION_EXPIRED_AUTO_DOWNGRADED_TO_DISCOVERY',entityType:'Client',entityId:client.id,metadata:{previousPlan,subscriptionEndsAt:client.subscriptionEndsAt,managedUsersDisabled:true,stationSessionsRevoked:true,freePlan:'DISCOVERY'}}});
      });
      if(client.email)await this.sendExpiryEmail(client.email,client.name,previousPlan).catch(()=>undefined);
      downgraded++;
    }
    return{checked:clients.length,downgraded};
  }

  private async sendExpiryEmail(to:string,name:string,previousPlan:string){
    const key=process.env.RESEND_API_KEY?.trim();const from=process.env.KHE_EMAIL_FROM?.trim();if(!key||!from)return;
    const origin=(process.env.WEB_ORIGIN||'https://khebooth.vercel.app').split(',')[0].trim().replace(/\/$/,'');
    await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:'Votre abonnement KHE BOOTH est arrivé à échéance',html:`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2 style="color:#b58a27">KHE BOOTH</h2><p>Bonjour ${name},</p><p>Votre abonnement <strong>${previousPlan}</strong> est arrivé à échéance. Vos fonctionnalités payantes ont été arrêtées automatiquement et votre compte est revenu à l’accès gratuit.</p><p>Vos données de compte ne sont pas supprimées. Vous pouvez renouveler quand vous le souhaitez pour retrouver les avantages de votre offre.</p><p><a href="${origin}/subscribe" style="display:inline-block;background:#111;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none">Voir les offres KHE BOOTH</a></p></div>`})});
  }
}
