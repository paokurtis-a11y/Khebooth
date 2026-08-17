import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedStation } from '../stations/station-auth.types';

type SiteConfigRow = {
  organizationId: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  appDownloadUrl: string | null;
  supportEmail: string | null;
  latestVersion: string;
  releaseNotes: string;
  maintenanceActive: boolean;
  maintenanceMessage: string | null;
  paymentMethods: unknown;
  faq: unknown;
};

type PlanRow = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  tagline: string;
  priceMonthlyChf: number | null;
  features: unknown;
  active: boolean;
  highlighted: boolean;
  stripePriceId: string | null;
  sortOrder: number;
};

type ClientRow = {
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  kheCode: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  paymentStatus: string;
  subscriptionStartedAt: Date | null;
  subscriptionEndsAt: Date | null;
  billingCustomerId: string | null;
  billingSubscriptionId: string | null;
  marketingEmailsEnabled: boolean;
};

@Injectable()
export class CommerceService {
  constructor(private readonly prisma: PrismaService) {}

  private async firstOrganizationId(): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1`;
    if (!rows[0]) throw new ServiceUnavailableException('KHE Booth organization is not initialized');
    return rows[0].id;
  }

  private async ensureConfig(organizationId: string): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO "MarketingSiteConfig" ("organizationId") VALUES (${organizationId}::uuid)
      ON CONFLICT ("organizationId") DO NOTHING
    `;
  }

  async publicSiteConfig() {
    const organizationId = await this.firstOrganizationId();
    await this.ensureConfig(organizationId);
    const configs = await this.prisma.$queryRaw<SiteConfigRow[]>`
      SELECT * FROM "MarketingSiteConfig" WHERE "organizationId" = ${organizationId}::uuid LIMIT 1
    `;
    const plans = await this.prisma.$queryRaw<PlanRow[]>`
      SELECT * FROM "SubscriptionPlanConfig"
      WHERE "organizationId" = ${organizationId}::uuid AND active = TRUE
      ORDER BY "sortOrder" ASC, name ASC
    `;
    return { ...configs[0], plans };
  }

  async adminSiteConfig(organizationId: string) {
    await this.ensureConfig(organizationId);
    const configs = await this.prisma.$queryRaw<SiteConfigRow[]>`
      SELECT * FROM "MarketingSiteConfig" WHERE "organizationId" = ${organizationId}::uuid LIMIT 1
    `;
    const plans = await this.prisma.$queryRaw<PlanRow[]>`
      SELECT * FROM "SubscriptionPlanConfig" WHERE "organizationId" = ${organizationId}::uuid ORDER BY "sortOrder" ASC, name ASC
    `;
    return { ...configs[0], plans };
  }

  async updateSiteConfig(organizationId: string, payload: Record<string, unknown>) {
    const heroTitle = String(payload.heroTitle ?? '').trim();
    const heroSubtitle = String(payload.heroSubtitle ?? '').trim();
    const primaryCta = String(payload.primaryCta ?? '').trim();
    const appDownloadUrl = payload.appDownloadUrl ? String(payload.appDownloadUrl).trim() : null;
    const supportEmail = payload.supportEmail ? String(payload.supportEmail).trim().toLowerCase() : null;
    const latestVersion = String(payload.latestVersion ?? '').trim() || '0.2.0';
    const releaseNotes = String(payload.releaseNotes ?? '').trim();
    const maintenanceActive = Boolean(payload.maintenanceActive);
    const maintenanceMessage = payload.maintenanceMessage ? String(payload.maintenanceMessage).trim() : null;
    const paymentMethods = Array.isArray(payload.paymentMethods) ? payload.paymentMethods : ['card', 'apple_pay', 'google_pay', 'twint'];
    const faq = Array.isArray(payload.faq) ? payload.faq : [];
    if (!heroTitle || !heroSubtitle || !primaryCta) throw new BadRequestException('Hero title, subtitle and CTA are required');

    await this.ensureConfig(organizationId);
    await this.prisma.$executeRaw`
      UPDATE "MarketingSiteConfig"
      SET "heroTitle" = ${heroTitle}, "heroSubtitle" = ${heroSubtitle}, "primaryCta" = ${primaryCta},
          "appDownloadUrl" = ${appDownloadUrl}, "supportEmail" = ${supportEmail}, "latestVersion" = ${latestVersion},
          "releaseNotes" = ${releaseNotes}, "maintenanceActive" = ${maintenanceActive}, "maintenanceMessage" = ${maintenanceMessage},
          "paymentMethods" = ${JSON.stringify(paymentMethods)}::jsonb, "faq" = ${JSON.stringify(faq)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organizationId}::uuid
    `;
    return this.adminSiteConfig(organizationId);
  }

  async updatePlan(organizationId: string, code: string, payload: Record<string, unknown>) {
    const name = String(payload.name ?? '').trim();
    const tagline = String(payload.tagline ?? '').trim();
    const rawPrice = payload.priceMonthlyChf;
    const priceMonthlyChf = rawPrice === null || rawPrice === '' || rawPrice === undefined ? null : Number(rawPrice);
    const features = Array.isArray(payload.features) ? payload.features.map(String).filter(Boolean) : [];
    const active = payload.active !== false;
    const highlighted = Boolean(payload.highlighted);
    const stripePriceId = payload.stripePriceId ? String(payload.stripePriceId).trim() : null;
    const sortOrder = Number(payload.sortOrder ?? 0);
    if (!name || !tagline || (priceMonthlyChf !== null && (!Number.isInteger(priceMonthlyChf) || priceMonthlyChf < 0))) {
      throw new BadRequestException('Invalid subscription plan');
    }
    await this.prisma.$executeRaw`
      UPDATE "SubscriptionPlanConfig"
      SET name = ${name}, tagline = ${tagline}, "priceMonthlyChf" = ${priceMonthlyChf}, features = ${JSON.stringify(features)}::jsonb,
          active = ${active}, highlighted = ${highlighted}, "stripePriceId" = ${stripePriceId}, "sortOrder" = ${sortOrder}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "organizationId" = ${organizationId}::uuid AND code = ${code}
    `;
    return this.adminSiteConfig(organizationId);
  }

  private kheCode(): string {
    return `KHE-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private async findOrCreatePublicClient(organizationId: string, email: string, name?: string): Promise<ClientRow> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.$queryRaw<ClientRow[]>`
      SELECT * FROM "Client" WHERE "organizationId" = ${organizationId}::uuid AND lower(email) = ${normalizedEmail} LIMIT 1
    `;
    if (existing[0]) return existing[0];
    const displayName = name?.trim() || normalizedEmail.split('@')[0] || 'Client KHE';
    const code = this.kheCode();
    const rows = await this.prisma.$queryRaw<ClientRow[]>`
      INSERT INTO "Client" (id, "organizationId", name, email, "kheCode", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${organizationId}::uuid, ${displayName}, ${normalizedEmail}, ${code}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    return rows[0];
  }

  private async plan(organizationId: string, code: string): Promise<PlanRow> {
    const rows = await this.prisma.$queryRaw<PlanRow[]>`
      SELECT * FROM "SubscriptionPlanConfig" WHERE "organizationId" = ${organizationId}::uuid AND code = ${code} AND active = TRUE LIMIT 1
    `;
    if (!rows[0]) throw new BadRequestException('Unknown subscription plan');
    return rows[0];
  }

  async checkout(payload: Record<string, unknown>) {
    const organizationId = await this.firstOrganizationId();
    const email = String(payload.email ?? '').trim().toLowerCase();
    const name = payload.name ? String(payload.name) : undefined;
    const planCode = String(payload.planCode ?? '').trim().toUpperCase();
    const paymentMethod = String(payload.paymentMethod ?? 'card').trim().toLowerCase();
    if (!email.includes('@')) throw new BadRequestException('A valid email is required');
    const plan = await this.plan(organizationId, planCode);
    if (plan.priceMonthlyChf === null) return { requiresContact: true, message: 'Cette offre nécessite une configuration sur mesure.' };
    const client = await this.findOrCreatePublicClient(organizationId, email, name);

    if (plan.priceMonthlyChf === 0) {
      await this.activateClient(client.id, plan.code, 'DISCOVERY', null, null);
      return { free: true, clientId: client.id, kheCode: client.kheCode };
    }

    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secret) throw new ServiceUnavailableException('Online payments are not configured yet');
    const webOrigin = (process.env.WEB_ORIGIN || 'https://khebooth-rdvo.vercel.app').split(',')[0].trim().replace(/\/$/, '');
    const isTwint = paymentMethod === 'twint';
    const params = new URLSearchParams();
    params.set('success_url', `${webOrigin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${webOrigin}/subscribe?plan=${encodeURIComponent(plan.code)}`);
    params.set('customer_email', email);
    params.set('metadata[clientId]', client.id);
    params.set('metadata[planCode]', plan.code);
    params.set('metadata[paymentMethod]', paymentMethod);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', 'chf');
    params.set('line_items[0][price_data][unit_amount]', String(plan.priceMonthlyChf));
    params.set('line_items[0][price_data][product_data][name]', `KHE Booth ${plan.name}`);

    if (isTwint) {
      params.set('mode', 'payment');
      params.append('payment_method_types[]', 'twint');
      params.set('metadata[billingMode]', 'twint_manual_renewal');
    } else {
      params.set('mode', 'subscription');
      params.append('payment_method_types[]', 'card');
      params.set('line_items[0][price_data][recurring][interval]', 'month');
      params.set('subscription_data[metadata][clientId]', client.id);
      params.set('subscription_data[metadata][planCode]', plan.code);
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await response.json() as { id?: string; url?: string; error?: { message?: string } };
    if (!response.ok || !data.url) throw new ServiceUnavailableException(data.error?.message || 'Unable to start secure checkout');

    await this.prisma.$executeRaw`
      UPDATE "Client" SET "subscriptionPlan" = ${plan.code}, "subscriptionStatus" = 'PAYMENT_PENDING', "paymentStatus" = 'PENDING', "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${client.id}::uuid
    `;
    return { checkoutUrl: data.url, sessionId: data.id };
  }

  verifyStripeSignature(rawBody: Buffer, signature: string | undefined): void {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret) throw new ServiceUnavailableException('Stripe webhook secret is not configured');
    if (!signature) throw new UnauthorizedException('Missing Stripe signature');
    const parts = signature.split(',');
    const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
    const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
    if (!timestamp || signatures.length === 0) throw new UnauthorizedException('Invalid Stripe signature');
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > 300) throw new UnauthorizedException('Expired Stripe signature');
    const digest = createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
    const expected = Buffer.from(digest, 'hex');
    const valid = signatures.some((candidate) => {
      try { const actual = Buffer.from(candidate, 'hex'); return actual.length === expected.length && timingSafeEqual(actual, expected); } catch { return false; }
    });
    if (!valid) throw new UnauthorizedException('Invalid Stripe signature');
  }

  async handleStripeEvent(event: any) {
    const providerEventId = String(event?.id ?? '');
    const eventType = String(event?.type ?? '');
    if (!providerEventId || !eventType) throw new BadRequestException('Invalid Stripe event');
    const already = await this.prisma.$queryRaw<Array<{ providerEventId: string }>>`
      SELECT "providerEventId" FROM "BillingEvent" WHERE "providerEventId" = ${providerEventId} LIMIT 1
    `;
    if (already[0]) return { received: true, duplicate: true };

    const object = event?.data?.object ?? {};
    let clientId: string | null = object?.metadata?.clientId ?? null;
    let planCode: string | null = object?.metadata?.planCode ?? null;
    const customerId = typeof object?.customer === 'string' ? object.customer : null;
    const subscriptionId = typeof object?.subscription === 'string' ? object.subscription : (eventType.startsWith('customer.subscription.') ? object?.id ?? null : null);

    if (!clientId && (customerId || subscriptionId)) {
      const rows = await this.prisma.$queryRaw<ClientRow[]>`
        SELECT * FROM "Client"
        WHERE (${customerId}::text IS NOT NULL AND "billingCustomerId" = ${customerId})
           OR (${subscriptionId}::text IS NOT NULL AND "billingSubscriptionId" = ${subscriptionId})
        LIMIT 1
      `;
      clientId = rows[0]?.id ?? null;
      planCode = planCode ?? rows[0]?.subscriptionPlan ?? null;
    }

    const organizationId = await this.firstOrganizationId();
    await this.prisma.$executeRaw`
      INSERT INTO "BillingEvent" (id, "organizationId", provider, "providerEventId", "eventType", payload)
      VALUES (gen_random_uuid(), ${organizationId}::uuid, 'stripe', ${providerEventId}, ${eventType}, ${JSON.stringify(event)}::jsonb)
    `;

    if (clientId) {
      if (eventType === 'checkout.session.completed' && object?.payment_status === 'paid') {
        await this.activateClient(clientId, planCode || 'DISCOVERY', object?.metadata?.paymentMethod || 'stripe', customerId, subscriptionId);
      } else if (eventType === 'invoice.paid') {
        await this.activateClient(clientId, planCode || 'DISCOVERY', 'stripe', customerId, subscriptionId);
      } else if (eventType === 'invoice.payment_failed') {
        await this.setPaymentProblem(clientId);
      } else if (eventType === 'customer.subscription.deleted') {
        await this.prisma.$executeRaw`UPDATE "Client" SET "subscriptionStatus"='CANCELLED', "updatedAt"=CURRENT_TIMESTAMP WHERE id=${clientId}::uuid`;
        await this.createClientMessage(clientId, 'SUBSCRIPTION', 'Abonnement terminé', 'Votre abonnement KHE Booth est terminé. Vous pouvez le réactiver à tout moment depuis KHE Booth.', '/subscribe', true);
      } else if (eventType === 'customer.subscription.updated' && ['active', 'trialing'].includes(String(object?.status))) {
        await this.prisma.$executeRaw`UPDATE "Client" SET "subscriptionStatus"='ACTIVE', "billingSubscriptionId"=${subscriptionId}, "updatedAt"=CURRENT_TIMESTAMP WHERE id=${clientId}::uuid`;
      }
    }
    return { received: true };
  }

  private async activateClient(clientId: string, planCode: string, provider: string, customerId: string | null, subscriptionId: string | null) {
    const clients = await this.prisma.$queryRaw<ClientRow[]>`SELECT * FROM "Client" WHERE id=${clientId}::uuid LIMIT 1`;
    const client = clients[0];
    if (!client) return;
    const code = client.kheCode || this.kheCode();
    await this.prisma.$executeRaw`
      UPDATE "Client"
      SET "kheCode"=${code}, "subscriptionPlan"=${planCode}, "subscriptionStatus"='ACTIVE', "paymentStatus"='PAID',
          "subscriptionStartedAt"=COALESCE("subscriptionStartedAt",CURRENT_TIMESTAMP), "billingProvider"=${provider},
          "billingCustomerId"=COALESCE(${customerId},"billingCustomerId"), "billingSubscriptionId"=COALESCE(${subscriptionId},"billingSubscriptionId"),
          "lastPaymentAt"=CURRENT_TIMESTAMP, "updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${clientId}::uuid
    `;
    await this.createClientMessage(clientId, 'SUBSCRIPTION', 'Abonnement KHE Booth activé', `Votre abonnement ${planCode} est actif. Votre identifiant KHE est ${code}.`, '/profile', true);
  }

  private async setPaymentProblem(clientId: string) {
    await this.prisma.$executeRaw`UPDATE "Client" SET "paymentStatus"='OVERDUE', "subscriptionStatus"='PAYMENT_PENDING', "updatedAt"=CURRENT_TIMESTAMP WHERE id=${clientId}::uuid`;
    await this.createClientMessage(clientId, 'PAYMENT', 'Paiement à régulariser', 'Votre dernier paiement KHE Booth n’a pas abouti. Mettez à jour votre moyen de paiement pour conserver toutes les fonctionnalités.', '/subscribe', true);
  }

  async createClientMessage(clientId: string, kind: string, title: string, body: string, actionUrl?: string | null, emailRequested = false) {
    const clients = await this.prisma.$queryRaw<ClientRow[]>`SELECT * FROM "Client" WHERE id=${clientId}::uuid LIMIT 1`;
    const client = clients[0];
    if (!client) throw new BadRequestException('Client not found');
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "ClientMessage" (id,"organizationId","clientId",kind,title,body,"actionUrl","emailRequested")
      VALUES (gen_random_uuid(),${client.organizationId}::uuid,${clientId}::uuid,${kind},${title},${body},${actionUrl ?? null},${emailRequested}) RETURNING id
    `;
    if (emailRequested && client.email && client.marketingEmailsEnabled) await this.sendEmail(client.email, title, body, client.kheCode);
    return { id: rows[0]?.id };
  }

  private async sendEmail(to: string, subject: string, body: string, kheCode?: string | null): Promise<void> {
    const key = process.env.RESEND_API_KEY?.trim();
    const from = process.env.KHE_EMAIL_FROM?.trim();
    if (!key || !from) return;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html: `<div style="font-family:Arial,sans-serif"><h2>${subject}</h2><p>${body}</p>${kheCode ? `<p><strong>KHE ID : ${kheCode}</strong></p>` : ''}<p>KHE Booth · Kurtis Hypnotic Events</p></div>` }),
    });
  }

  async manualMessage(organizationId: string, clientId: string, payload: Record<string, unknown>) {
    const owned = await this.prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Client" WHERE id=${clientId}::uuid AND "organizationId"=${organizationId}::uuid LIMIT 1`;
    if (!owned[0]) throw new BadRequestException('Client not found');
    return this.createClientMessage(clientId, String(payload.kind ?? 'MANUAL'), String(payload.title ?? '').trim(), String(payload.body ?? '').trim(), payload.actionUrl ? String(payload.actionUrl) : null, Boolean(payload.emailRequested));
  }

  async stationClientExperience(station: AuthenticatedStation) {
    const rows = await this.prisma.$queryRaw<ClientRow[]>`
      SELECT c.* FROM "Client" c JOIN "Event" e ON e."clientId"=c.id
      WHERE e.id=${station.eventId}::uuid AND e."organizationId"=${station.organizationId}::uuid LIMIT 1
    `;
    const client = rows[0];
    const configRows = await this.prisma.$queryRaw<SiteConfigRow[]>`SELECT * FROM "MarketingSiteConfig" WHERE "organizationId"=${station.organizationId}::uuid LIMIT 1`;
    const config = configRows[0];
    if (!client) return { client: null, automaticMessages: config?.maintenanceActive ? [{ kind:'MAINTENANCE', title:'Information KHE Booth', body:config.maintenanceMessage || 'Maintenance en cours.' }] : [], messages: [] };
    const messages = await this.prisma.$queryRaw<any[]>`
      SELECT id,kind,title,body,"actionUrl","readAt","createdAt" FROM "ClientMessage" WHERE "clientId"=${client.id}::uuid ORDER BY "createdAt" DESC LIMIT 50
    `;
    const automaticMessages: Array<{ kind:string; title:string; body:string; actionUrl?:string }> = [];
    if (client.paymentStatus === 'OVERDUE') automaticMessages.push({ kind:'PAYMENT', title:'Action requise', body:'Votre paiement doit être régularisé pour éviter une interruption de service.', actionUrl:'/subscribe' });
    if (client.subscriptionPlan === 'DISCOVERY') automaticMessages.push({ kind:'PROMO', title:'Passez à la vitesse supérieure', body:'Activez Starter ou Pro pour profiter de CAPTURE, SHARING, QR et du cloud KHE Booth.', actionUrl:'/subscribe' });
    if (config?.latestVersion) automaticMessages.push({ kind:'UPDATE', title:`KHE Booth ${config.latestVersion}`, body:config.releaseNotes || 'Une nouvelle version de KHE Booth est disponible.', actionUrl:config.appDownloadUrl || undefined });
    if (config?.maintenanceActive) automaticMessages.unshift({ kind:'MAINTENANCE', title:'Information de service', body:config.maintenanceMessage || 'KHE Booth est momentanément en maintenance.' });
    return {
      client: { id:client.id, name:client.name, email:client.email, kheCode:client.kheCode, subscriptionPlan:client.subscriptionPlan, subscriptionStatus:client.subscriptionStatus, paymentStatus:client.paymentStatus, subscriptionStartedAt:client.subscriptionStartedAt, subscriptionEndsAt:client.subscriptionEndsAt },
      automaticMessages,
      messages,
    };
  }
}
