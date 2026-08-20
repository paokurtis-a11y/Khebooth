import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from './station-auth.types';

type ClientRow={id:string;name:string;email:string|null;subscriptionPlan:string;subscriptionStatus:string;paymentStatus:string};
type BillingRow={id:string;documentType:string;documentNumber:string|null;status:string;currency:string;subtotalCents:number;taxCents:number;totalCents:number;taxCountry:string|null;hostedUrl:string|null;pdfUrl:string|null;receiptUrl:string|null;periodStart:Date|null;periodEnd:Date|null;dueAt:Date|null;issuedAt:Date|null;paidAt:Date|null;createdAt:Date};

@Injectable()
export class StationBillingService{
  constructor(private readonly prisma:PrismaService){}

  async get(station:AuthenticatedStation){
    const clients=await this.prisma.$queryRaw<ClientRow[]>(Prisma.sql`
      SELECT c.id,c.name,c.email,c."subscriptionPlan",c."subscriptionStatus",c."paymentStatus"
      FROM "Client" c
      JOIN "Event" e ON e."clientId"=c.id
      WHERE e.id=${station.eventId}::uuid AND e."organizationId"=${station.organizationId}::uuid AND c."organizationId"=${station.organizationId}::uuid
      LIMIT 1
    `);
    const client=clients[0];
    if(!client)return{client:null,documents:[]};
    const documents=await this.prisma.$queryRaw<BillingRow[]>(Prisma.sql`
      SELECT id,"documentType","documentNumber",status,currency,"subtotalCents","taxCents","totalCents","taxCountry","hostedUrl","pdfUrl","receiptUrl","periodStart","periodEnd","dueAt","issuedAt","paidAt","createdAt"
      FROM "BillingDocument"
      WHERE "organizationId"=${station.organizationId}::uuid AND "clientId"=${client.id}::uuid
      ORDER BY COALESCE("issuedAt","createdAt") DESC
      LIMIT 36
    `);
    return{client,documents};
  }
}
