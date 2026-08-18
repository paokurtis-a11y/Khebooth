import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from '../stations/station-auth.types';

export type KhePlan = 'DISCOVERY' | 'STARTER' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
export type KheEntitlement =
  | 'CAPTURE_LOCAL'
  | 'STUDIO_BASIC'
  | 'SHARING'
  | 'CLOUD_SYNC'
  | 'GUEST_QR'
  | 'STUDIO_ADVANCED'
  | 'ADVANCED_AUDIO'
  | 'ADVANCED_BRANDING'
  | 'UNLIMITED_EVENTS'
  | 'MULTI_USER'
  | 'ADVANCED_CLIENTS'
  | 'MARKETING_ANALYTICS'
  | 'MULTI_SITE'
  | 'CUSTOM_INTEGRATIONS';

type ClientSubscriptionRow = {
  clientId: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  paymentStatus: string | null;
};

const PLAN_RANK: Record<KhePlan, number> = { DISCOVERY: 0, STARTER: 1, PRO: 2, BUSINESS: 3, ENTERPRISE: 4 };
const REQUIRED_PLAN: Record<KheEntitlement, KhePlan> = {
  CAPTURE_LOCAL: 'DISCOVERY',
  STUDIO_BASIC: 'DISCOVERY',
  SHARING: 'STARTER',
  CLOUD_SYNC: 'STARTER',
  GUEST_QR: 'STARTER',
  STUDIO_ADVANCED: 'PRO',
  ADVANCED_AUDIO: 'PRO',
  ADVANCED_BRANDING: 'PRO',
  UNLIMITED_EVENTS: 'PRO',
  MULTI_USER: 'BUSINESS',
  ADVANCED_CLIENTS: 'BUSINESS',
  MARKETING_ANALYTICS: 'BUSINESS',
  MULTI_SITE: 'ENTERPRISE',
  CUSTOM_INTEGRATIONS: 'ENTERPRISE',
};

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePlan(value: string | null | undefined): KhePlan {
    return value && value in PLAN_RANK ? (value as KhePlan) : 'DISCOVERY';
  }

  private effectivePlan(row: ClientSubscriptionRow | undefined): KhePlan {
    const requested = this.normalizePlan(row?.subscriptionPlan);
    if (requested === 'DISCOVERY') return 'DISCOVERY';
    if (row?.subscriptionStatus === 'ACTIVE' && row?.paymentStatus === 'PAID') return requested;
    return 'DISCOVERY';
  }

  async forEvent(organizationId: string, eventId: string) {
    const rows = await this.prisma.$queryRaw<ClientSubscriptionRow[]>`
      SELECT e."clientId" AS "clientId", c."subscriptionPlan", c."subscriptionStatus", c."paymentStatus"
      FROM "Event" e
      LEFT JOIN "Client" c ON c.id = e."clientId"
      WHERE e.id = ${eventId}::uuid AND e."organizationId" = ${organizationId}::uuid
      LIMIT 1
    `;
    const plan = this.effectivePlan(rows[0]);
    const rank = PLAN_RANK[plan];
    const entitlements = Object.fromEntries(
      Object.entries(REQUIRED_PLAN).map(([feature, required]) => [feature, rank >= PLAN_RANK[required]]),
    ) as Record<KheEntitlement, boolean>;
    const maxActiveEvents = plan === 'DISCOVERY' ? 1 : plan === 'STARTER' ? 5 : null;
    return { plan, entitlements, maxActiveEvents, clientId: rows[0]?.clientId ?? null };
  }

  forStation(station: AuthenticatedStation) {
    return this.forEvent(station.organizationId, station.eventId);
  }

  async requireEvent(organizationId: string, eventId: string, feature: KheEntitlement) {
    const access = await this.forEvent(organizationId, eventId);
    if (!access.entitlements[feature]) {
      throw new ForbiddenException(`Cette fonctionnalité nécessite l'abonnement ${REQUIRED_PLAN[feature]} ou supérieur.`);
    }
    return access;
  }

  requireStation(station: AuthenticatedStation, feature: KheEntitlement) {
    return this.requireEvent(station.organizationId, station.eventId, feature);
  }
}
