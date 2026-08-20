import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EnterprisePaymentOnboardingService } from '../commerce/enterprise-payment-onboarding.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateClientDto,
  type ApiPaymentStatus,
  type ApiSubscriptionPlan,
  type ApiSubscriptionStatus,
} from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

type SubscriptionSnapshot = {
  id: string;
  subscriptionPlan: ApiSubscriptionPlan;
  subscriptionStatus: ApiSubscriptionStatus;
  paymentStatus: ApiPaymentStatus;
  subscriptionStartedAt: Date | null;
  subscriptionEndsAt: Date | null;
};

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService,private readonly enterpriseAutoInvite:EnterprisePaymentOnboardingService) {}

  private present<T extends { name: string; email: string | null }>(client: T) {
    const parts = client.name.trim().split(/\s+/).filter(Boolean);
    const firstName = parts.length > 1 ? parts[0] : '';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : (parts[0] ?? '');
    return { ...client, firstName, lastName };
  }

  private async subscriptionFor(id: string): Promise<SubscriptionSnapshot> {
    const rows = await this.prisma.$queryRaw<SubscriptionSnapshot[]>`
      SELECT id,"subscriptionPlan","subscriptionStatus","paymentStatus","subscriptionStartedAt","subscriptionEndsAt"
      FROM "Client" WHERE id = ${id}::uuid LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException('Client not found');
    return rows[0];
  }

  private resolveSubscription(dto: CreateClientDto | UpdateClientDto,current?: SubscriptionSnapshot): Omit<SubscriptionSnapshot, 'id'> {
    const subscriptionPlan = dto.subscriptionPlan ?? current?.subscriptionPlan ?? 'DISCOVERY';
    const paymentStatus = dto.paymentStatus ?? current?.paymentStatus ?? 'UNPAID';
    let subscriptionStatus = dto.subscriptionStatus ?? current?.subscriptionStatus ?? 'PROSPECT';
    if (dto.subscriptionStatus === undefined) {
      if (paymentStatus === 'PAID' && subscriptionPlan !== 'DISCOVERY') subscriptionStatus = 'ACTIVE';
      else if (subscriptionPlan !== 'DISCOVERY' && paymentStatus === 'PENDING') subscriptionStatus = 'PAYMENT_PENDING';
      else if (subscriptionPlan !== 'DISCOVERY' && subscriptionStatus === 'PROSPECT') subscriptionStatus = 'PLAN_SELECTED';
    }
    const subscriptionStartedAt = dto.subscriptionStartedAt ? new Date(dto.subscriptionStartedAt) : current?.subscriptionStartedAt ?? (subscriptionStatus === 'ACTIVE' ? new Date() : null);
    const subscriptionEndsAt = dto.subscriptionEndsAt ? new Date(dto.subscriptionEndsAt) : current?.subscriptionEndsAt ?? null;
    return { subscriptionPlan, subscriptionStatus, paymentStatus, subscriptionStartedAt, subscriptionEndsAt };
  }

  private async maybeInviteEnterprise(id:string,subscription:{subscriptionPlan:ApiSubscriptionPlan;paymentStatus:ApiPaymentStatus}){
    if(subscription.subscriptionPlan==='ENTERPRISE'&&subscription.paymentStatus==='PAID')await this.enterpriseAutoInvite.ensureInvitationForClient(id,'manual-client-update').catch(()=>undefined);
  }

  async list(organizationId: string) {
    const archived=await this.prisma.$queryRaw<Array<{id:string}>>`SELECT id FROM "Client" WHERE "organizationId"=${organizationId}::uuid AND "archivedAt" IS NOT NULL`;
    const clients = await this.prisma.client.findMany({ where: { organizationId,...(archived.length?{id:{notIn:archived.map((item)=>item.id)}}:{}) }, orderBy: { createdAt: 'desc' } });
    if (clients.length === 0) return [];
    const subscriptions = await this.prisma.$queryRaw<SubscriptionSnapshot[]>`
      SELECT id,"subscriptionPlan","subscriptionStatus","paymentStatus","subscriptionStartedAt","subscriptionEndsAt"
      FROM "Client" WHERE "organizationId" = ${organizationId}::uuid AND "archivedAt" IS NULL
    `;
    const byId = new Map(subscriptions.map((item) => [item.id, item]));
    return clients.map((client) => this.present({ ...client, ...byId.get(client.id) }));
  }

  async get(organizationId: string, id: string) {
    const client = await this.prisma.client.findFirst({ where: { id, organizationId } });
    if (!client) throw new NotFoundException('Client not found');
    const subscription = await this.subscriptionFor(id);
    return this.present({ ...client, ...subscription });
  }

  async create(organizationId: string, userId: string, dto: CreateClientDto) {
    const firstName = dto.firstName.trim();const lastName = dto.name.trim();const email = dto.email.trim().toLowerCase();
    if (!firstName || !lastName || !email) throw new BadRequestException('First name, last name and email are required');
    const subscription = this.resolveSubscription(dto);
    const result=await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({data:{organizationId,name:`${firstName} ${lastName}`,email,phone:dto.phone?.trim()||null,companyName:dto.companyName?.trim()||null,notes:dto.notes?.trim()||null}});
      await tx.$executeRaw`UPDATE "Client" SET "subscriptionPlan"=${subscription.subscriptionPlan},"subscriptionStatus"=${subscription.subscriptionStatus},"paymentStatus"=${subscription.paymentStatus},"subscriptionStartedAt"=${subscription.subscriptionStartedAt},"subscriptionEndsAt"=${subscription.subscriptionEndsAt},"emailSource"='MANUAL_CRM',"emailLastCapturedAt"=CURRENT_TIMESTAMP WHERE id=${client.id}::uuid`;
      await tx.auditLog.create({data:{organizationId,userId,action:'CLIENT_CREATED',entityType:'Client',entityId:client.id,metadata:{subscriptionPlan:subscription.subscriptionPlan,subscriptionStatus:subscription.subscriptionStatus,paymentStatus:subscription.paymentStatus,emailSource:'MANUAL_CRM'}}});
      return this.present({ ...client, id: client.id, ...subscription });
    });
    await this.maybeInviteEnterprise(result.id,subscription);return result;
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateClientDto) {
    const current = await this.get(organizationId, id);const currentSubscription = await this.subscriptionFor(id);
    const firstName = (dto.firstName ?? current.firstName).trim();const lastName = (dto.name ?? current.lastName).trim();const email = (dto.email ?? current.email ?? '').trim().toLowerCase();
    if (!firstName || !lastName || !email) throw new BadRequestException('First name, last name and email are required');
    const subscription = this.resolveSubscription(dto, currentSubscription);const emailChanged=(current.email??'').trim().toLowerCase()!==email;
    const result=await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.update({where:{id},data:{name:`${firstName} ${lastName}`,email,...(dto.phone!==undefined?{phone:dto.phone.trim()||null}:{}),...(dto.companyName!==undefined?{companyName:dto.companyName.trim()||null}:{}),...(dto.notes!==undefined?{notes:dto.notes.trim()||null}:{})}});
      await tx.$executeRaw`UPDATE "Client" SET "subscriptionPlan"=${subscription.subscriptionPlan},"subscriptionStatus"=${subscription.subscriptionStatus},"paymentStatus"=${subscription.paymentStatus},"subscriptionStartedAt"=${subscription.subscriptionStartedAt},"subscriptionEndsAt"=${subscription.subscriptionEndsAt},"emailSource"='MANUAL_CRM',"emailLastCapturedAt"=CURRENT_TIMESTAMP,"marketingEmailsEnabled"=CASE WHEN ${emailChanged} THEN FALSE ELSE "marketingEmailsEnabled" END,"marketingConsentAt"=CASE WHEN ${emailChanged} THEN NULL ELSE "marketingConsentAt" END,"marketingConsentSource"=CASE WHEN ${emailChanged} THEN NULL ELSE "marketingConsentSource" END,"marketingConsentVersion"=CASE WHEN ${emailChanged} THEN NULL ELSE "marketingConsentVersion" END,"marketingUnsubscribedAt"=CASE WHEN ${emailChanged} THEN NULL ELSE "marketingUnsubscribedAt" END WHERE id=${id}::uuid`;
      if(emailChanged)await tx.$executeRaw`UPDATE "MarketingEmailJourney" SET "cancelledAt"=CURRENT_TIMESTAMP,"nextDueAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "clientId"=${id}::uuid AND "completedAt" IS NULL AND "cancelledAt" IS NULL`;
      await tx.auditLog.create({data:{organizationId,userId,action:'CLIENT_UPDATED',entityType:'Client',entityId:id,metadata:{subscriptionPlan:subscription.subscriptionPlan,subscriptionStatus:subscription.subscriptionStatus,paymentStatus:subscription.paymentStatus,emailChanged,marketingConsentReset:emailChanged}}});
      return this.present({ ...client, ...subscription });
    });
    await this.maybeInviteEnterprise(id,subscription);return result;
  }

  async remove(organizationId: string, userId: string, id: string) {
    await this.get(organizationId, id);await this.prisma.client.delete({ where: { id } });await this.audit(organizationId, userId, 'CLIENT_DELETED', id);return { deleted: true };
  }

  private audit(organizationId: string, userId: string, action: string, entityId: string) {
    return this.prisma.auditLog.create({ data: { organizationId, userId, action, entityType: 'Client', entityId } });
  }
}
