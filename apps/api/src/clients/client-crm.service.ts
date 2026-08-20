import { Injectable, NotFoundException } from '@nestjs/common';
import { EmailMarketingService } from '../marketing/email-marketing.service';
import { PrismaService } from '../prisma/prisma.service';

export type CrmClientRow={id:string;name:string;email:string|null;phone:string|null;companyName:string|null;notes:string|null;subscriptionPlan:string;subscriptionStatus:string;paymentStatus:string;archivedAt:Date|null;emailSource:string|null;emailLastCapturedAt:Date|null;marketingEmailsEnabled:boolean;marketingConsentAt:Date|null;marketingConsentSource:string|null;marketingUnsubscribedAt:Date|null;lastMarketingEmailAt:Date|null;createdAt:Date;updatedAt:Date;profileFirstName:string|null;profileLastName:string|null;profileEmail:string|null;profilePhone:string|null;profileCompany:string|null;profileSource:string|null;profileSyncedAt:Date|null};

@Injectable()
export class ClientCrmService{
  constructor(private readonly prisma:PrismaService,private readonly emailMarketing:EmailMarketingService){}

  async list(organizationId:string,archived=false,search=''){
    const term=search.trim().toLowerCase();
    return this.prisma.$queryRaw<CrmClientRow[]>`
      SELECT c.id,c.name,c.email,c.phone,c."companyName",c.notes,c."subscriptionPlan",c."subscriptionStatus",c."paymentStatus",c."archivedAt",c."emailSource",c."emailLastCapturedAt",c."marketingEmailsEnabled",c."marketingConsentAt",c."marketingConsentSource",c."marketingUnsubscribedAt",c."lastMarketingEmailAt",c."createdAt",c."updatedAt",
             p."firstName" AS "profileFirstName",p."lastName" AS "profileLastName",p.email AS "profileEmail",p.phone AS "profilePhone",p.company AS "profileCompany",p.source AS "profileSource",p."syncedAt" AS "profileSyncedAt"
      FROM "Client" c LEFT JOIN "ClientProfileSnapshot" p ON p."clientId"=c.id
      WHERE c."organizationId"=${organizationId}::uuid
        AND (${archived}::boolean = (c."archivedAt" IS NOT NULL))
        AND (${term}='' OR lower(c.name) LIKE ${`%${term}%`} OR lower(COALESCE(c.email,'')) LIKE ${`%${term}%`} OR lower(COALESCE(c."companyName",'')) LIKE ${`%${term}%`} OR lower(COALESCE(c.phone,'')) LIKE ${`%${term}%`})
      ORDER BY COALESCE(c."lastMarketingEmailAt",c."updatedAt") DESC
      LIMIT 1000`;
  }

  async get(organizationId:string,id:string){const rows=await this.prisma.$queryRaw<CrmClientRow[]>`
      SELECT c.id,c.name,c.email,c.phone,c."companyName",c.notes,c."subscriptionPlan",c."subscriptionStatus",c."paymentStatus",c."archivedAt",c."emailSource",c."emailLastCapturedAt",c."marketingEmailsEnabled",c."marketingConsentAt",c."marketingConsentSource",c."marketingUnsubscribedAt",c."lastMarketingEmailAt",c."createdAt",c."updatedAt",
             p."firstName" AS "profileFirstName",p."lastName" AS "profileLastName",p.email AS "profileEmail",p.phone AS "profilePhone",p.company AS "profileCompany",p.source AS "profileSource",p."syncedAt" AS "profileSyncedAt"
      FROM "Client" c LEFT JOIN "ClientProfileSnapshot" p ON p."clientId"=c.id WHERE c.id=${id}::uuid AND c."organizationId"=${organizationId}::uuid LIMIT 1`;if(!rows[0])throw new NotFoundException('Client introuvable.');return rows[0];}

  async archive(organizationId:string,userId:string,id:string){await this.get(organizationId,id);await this.prisma.$transaction(async tx=>{await tx.$executeRaw`UPDATE "Client" SET "archivedAt"=CURRENT_TIMESTAMP,"archivedByUserId"=${userId}::uuid,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid AND "organizationId"=${organizationId}::uuid`;await tx.$executeRaw`UPDATE "MarketingEmailJourney" SET "cancelledAt"=CURRENT_TIMESTAMP,"nextDueAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "clientId"=${id}::uuid AND "completedAt" IS NULL AND "cancelledAt" IS NULL`;await tx.auditLog.create({data:{organizationId,userId,action:'CLIENT_ARCHIVED',entityType:'Client',entityId:id}});});return{archived:true};}
  async restore(organizationId:string,userId:string,id:string){await this.get(organizationId,id);await this.prisma.$transaction(async tx=>{await tx.$executeRaw`UPDATE "Client" SET "archivedAt"=NULL,"archivedByUserId"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE id=${id}::uuid AND "organizationId"=${organizationId}::uuid`;await tx.auditLog.create({data:{organizationId,userId,action:'CLIENT_RESTORED',entityType:'Client',entityId:id}});});return{restored:true};}
  history(organizationId:string,id:string){return this.emailMarketing.clientHistory(organizationId,id);}
}
