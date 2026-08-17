import { Injectable } from '@nestjs/common';
import { MarketingService } from '../marketing/marketing.service';
import { PrismaService } from '../prisma/prisma.service';

type ClientMailRow={organizationId:string;email:string|null;kheCode:string|null;subscriptionPlan:string;paymentStatus:string};

@Injectable()
export class PaymentAnalyticsService {
  constructor(private readonly prisma:PrismaService,private readonly marketing:MarketingService){}

  private async client(clientId:string):Promise<ClientMailRow|null>{
    const rows=await this.prisma.$queryRaw<ClientMailRow[]>`SELECT "organizationId",email,"kheCode","subscriptionPlan","paymentStatus" FROM "Client" WHERE id=${clientId}::uuid LIMIT 1`;
    return rows[0]??null;
  }

  async completed(clientId:string,planCode:string|null,valueCents:number,metadata:Record<string,unknown>={}){
    const client=await this.client(clientId);if(!client)return;
    await this.marketing.trackServer(client.organizationId,'CHECKOUT_COMPLETED',clientId,planCode,valueCents,metadata);
    if(client.email)await this.send(client.email,'Votre abonnement KHE Booth est actif',`Votre paiement a été confirmé. Votre offre ${planCode||client.subscriptionPlan} est active.${client.kheCode?` Votre identifiant KHE est ${client.kheCode}.`:''}`);
  }

  async failed(clientId:string){
    const client=await this.client(clientId);if(!client?.email)return;
    await this.send(client.email,'Action requise pour votre abonnement KHE Booth','Votre dernier paiement n’a pas abouti. Ouvrez Mon abonnement pour mettre à jour votre moyen de paiement et éviter une interruption de service.');
  }

  private async send(to:string,subject:string,text:string){
    const key=process.env.RESEND_API_KEY?.trim();const from=process.env.KHE_EMAIL_FROM?.trim();if(!key||!from)return;
    await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html:`<div style="font-family:Arial,sans-serif"><h2>${subject}</h2><p>${text}</p><p>KHE Booth · Kurtis Hypnotic Events</p></div>`})});
  }
}
