import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export const GLOBE_MODES = ['agents', 'clients', 'relations', 'visitors', 'growth', 'all'] as const;
export const GLOBE_WINDOWS = ['real-time', '1d', '7d', '30d'] as const;
export type GlobeMode = (typeof GLOBE_MODES)[number];
export type GlobeWindow = (typeof GLOBE_WINDOWS)[number];

type GlobeRequest = { mode: GlobeMode; window: GlobeWindow; windowDays: number };
type StrategyThresholds = {
  enabled: boolean;
  analysisWindowDays: number;
  highIntentScore: number;
  regularClientMinSessions: number;
  regularClientMinActiveDays: number;
  regularClientMinMinutes: number;
  geoSegmentationEnabled: boolean;
  anonymousAnalyticsEnabled: boolean;
};
type CacheEntry = { expiresAt: number; value: Promise<Record<string, unknown>> };
type GlobeAccessScope = {
  organizationId: string;
  managedClientId: string | null;
  accountPlan: string | null;
};

const CACHE_TTL_MS = 10_000;
export const LIVE_VISITOR_TTL_SECONDS = 75;
const DEFAULT_STRATEGY: StrategyThresholds = {
  enabled: true,
  analysisWindowDays: 30,
  highIntentScore: 60,
  regularClientMinSessions: 5,
  regularClientMinActiveDays: 3,
  regularClientMinMinutes: 60,
  geoSegmentationEnabled: true,
  anonymousAnalyticsEnabled: true,
};

export function normalizeCountryCode(value: unknown): string | null {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function roundCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? Math.round(coordinate * 100) / 100 : null;
}

export function parseGlobeRequest(modeValue: unknown, windowValue: unknown, role: UserRole): GlobeRequest {
  const mode = String(modeValue ?? 'agents').toLowerCase();
  const window = String(windowValue ?? 'real-time').toLowerCase();
  if (!GLOBE_MODES.includes(mode as GlobeMode)) throw new BadRequestException('Mode Globe KHE invalide');
  if (!GLOBE_WINDOWS.includes(window as GlobeWindow)) throw new BadRequestException('Fenêtre Globe KHE invalide');
  if (mode === 'all' && role !== UserRole.OWNER) throw new ForbiddenException('La vue Tout est réservée à l’OWNER');
  const normalizedWindow = window as GlobeWindow;
  return {
    mode: mode as GlobeMode,
    window: normalizedWindow,
    windowDays: normalizedWindow === '30d' ? 30 : normalizedWindow === '7d' ? 7 : 1,
  };
}

@Injectable()
export class GlobeIntelligenceService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async overview(user: AuthenticatedUser, mode?: unknown, window?: unknown) {
    const request = parseGlobeRequest(mode, window, user.role);
    const scope = await this.accessScope(user);
    if (scope.managedClientId && (request.mode === 'visitors' || request.mode === 'growth' || request.mode === 'all')) {
      throw new ForbiddenException('Ce compte peut consulter uniquement sa vue opérationnelle BUSINESS');
    }
    const cacheKey = `${scope.organizationId}:${scope.managedClientId ?? 'root'}:${request.mode}:${request.window}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const value = this.buildOverview(user, request, scope).catch((error) => {
      this.cache.delete(cacheKey);
      throw error;
    });
    this.cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [key, entry] of this.cache) if (entry.expiresAt <= now) this.cache.delete(key);
    }
    return value;
  }

  private async accessScope(user: AuthenticatedUser): Promise<GlobeAccessScope> {
    const rows = await this.prisma.$queryRaw<Array<{
      managedClientId: string | null;
      clientOrganizationId: string | null;
      subscriptionPlan: string | null;
      subscriptionStatus: string | null;
      paymentStatus: string | null;
      subscriptionEndsAt: Date | null;
    }>>`
      SELECT u."managedClientId",c."organizationId" AS "clientOrganizationId",c."subscriptionPlan",c."subscriptionStatus",c."paymentStatus",c."subscriptionEndsAt"
      FROM "User" u LEFT JOIN "Client" c ON c.id=u."managedClientId"
      WHERE u.id=${user.id}::uuid AND u."organizationId"=${user.organizationId}::uuid AND u."isActive"=TRUE
      LIMIT 1
    `;
    const row = rows[0];
    if (!row?.managedClientId) return { organizationId:user.organizationId, managedClientId:null, accountPlan:null };
    const eligiblePlan = row.subscriptionPlan === 'BUSINESS' || row.subscriptionPlan === 'ENTERPRISE';
    const expired = Boolean(row.subscriptionEndsAt && new Date(row.subscriptionEndsAt).getTime() <= Date.now());
    if (!eligiblePlan || row.subscriptionStatus !== 'ACTIVE' || row.paymentStatus !== 'PAID' || expired || !row.clientOrganizationId) {
      throw new ForbiddenException('Accès Globe réservé aux comptes BUSINESS ou ENTERPRISE actifs et payés');
    }
    return { organizationId:row.clientOrganizationId, managedClientId:row.managedClientId, accountPlan:row.subscriptionPlan };
  }

  private async strategy(organizationId: string): Promise<StrategyThresholds> {
    const rows = await this.prisma.$queryRaw<StrategyThresholds[]>`
      SELECT enabled,
        COALESCE("analysisWindowDays",30)::int AS "analysisWindowDays",
        COALESCE("highIntentScore",60)::int AS "highIntentScore",
        COALESCE("regularClientMinSessions",5)::int AS "regularClientMinSessions",
        COALESCE("regularClientMinActiveDays",3)::int AS "regularClientMinActiveDays",
        COALESCE("regularClientMinMinutes",60)::int AS "regularClientMinMinutes",
        COALESCE("geoSegmentationEnabled",TRUE) AS "geoSegmentationEnabled",
        COALESCE("anonymousAnalyticsEnabled",TRUE) AS "anonymousAnalyticsEnabled"
      FROM "GrowthStrategyConfig"
      WHERE "organizationId"=${organizationId}::uuid
      LIMIT 1
    `;
    return { ...DEFAULT_STRATEGY, ...(rows[0] ?? {}) };
  }

  private clients(organizationId: string, windowDays: number, managedClientId: string | null) {
    return this.prisma.$queryRaw<any[]>`
      SELECT c.id,c.name,c.email,c.phone,c."companyName",c.notes,c."subscriptionPlan",c."subscriptionStatus",c."paymentStatus",
        COALESCE(us.sessions,0)::int AS "connectionCount",COALESCE(us.days,0)::int AS "activeDays",
        COALESCE(us.seconds,0)::bigint AS "totalConnectedSeconds",us."lastSeenAt",us."lastCountryCode",us."lastRegionCode",us."lastMunicipality",us."lastLatitude",us."lastLongitude",
        COALESCE(ev.events,0)::int AS "eventCount",COALESCE(ev.active,0)::int AS "activeEventCount",
        COALESCE(st.sessions,0)::int AS "stationSessionCount",COALESCE(st."captureOnline",FALSE) AS "captureOnline",COALESCE(st."sharingOnline",FALSE) AS "sharingOnline",
        COALESCE(media.total,0)::int AS "mediaCount",COALESCE(media.pending,0)::int AS "pendingMediaCount",COALESCE(media.failed,0)::int AS "failedMediaCount",media."lastMediaAt"
      FROM "Client" c
      LEFT JOIN LATERAL (
        SELECT count(*) sessions,count(DISTINCT "startedAt"::date) days,
          COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE("endedAt","lastSeenAt")-"startedAt"))),0) seconds,max("lastSeenAt") "lastSeenAt",
          (array_agg(upper("countryCode") ORDER BY "lastSeenAt" DESC) FILTER(WHERE "countryCode" IS NOT NULL))[1] "lastCountryCode",
          (array_agg("regionCode" ORDER BY "lastSeenAt" DESC) FILTER(WHERE "regionCode" IS NOT NULL))[1] "lastRegionCode",
          (array_agg(municipality ORDER BY "lastSeenAt" DESC) FILTER(WHERE municipality IS NOT NULL))[1] "lastMunicipality",
          (array_agg(round(latitude::numeric,2) ORDER BY "lastSeenAt" DESC) FILTER(WHERE latitude IS NOT NULL AND "locationSharingEnabled"=TRUE))[1] "lastLatitude",
          (array_agg(round(longitude::numeric,2) ORDER BY "lastSeenAt" DESC) FILTER(WHERE longitude IS NOT NULL AND "locationSharingEnabled"=TRUE))[1] "lastLongitude"
        FROM "UserActivitySession" WHERE "clientId"=c.id AND "startedAt">=CURRENT_TIMESTAMP-${windowDays}*INTERVAL '1 day'
      ) us ON TRUE
      LEFT JOIN LATERAL (
        SELECT count(*) events,count(*) FILTER(WHERE status IN ('READY','ACTIVE')) active FROM "Event" WHERE "clientId"=c.id
      ) ev ON TRUE
      LEFT JOIN LATERAL (
        SELECT count(*) sessions,
          bool_or(ss.mode='CAPTURE' AND ss."revokedAt" IS NULL AND ss."expiresAt">CURRENT_TIMESTAMP AND ss."lastSeenAt">CURRENT_TIMESTAMP-INTERVAL '90 seconds') "captureOnline",
          bool_or(ss.mode='SHARING' AND ss."revokedAt" IS NULL AND ss."expiresAt">CURRENT_TIMESTAMP AND ss."lastSeenAt">CURRENT_TIMESTAMP-INTERVAL '90 seconds') "sharingOnline"
        FROM "StationSession" ss JOIN "Event" e ON e.id=ss."eventId" WHERE e."clientId"=c.id
      ) st ON TRUE
      LEFT JOIN LATERAL (
        SELECT count(*) total,count(*) FILTER(WHERE m."syncState" IN ('QUEUED','UPLOADING')) pending,
          count(*) FILTER(WHERE m."syncState"='FAILED') failed,max(m."createdAt") "lastMediaAt"
        FROM "MediaAsset" m JOIN "Event" e ON e.id=m."eventId" WHERE e."clientId"=c.id
      ) media ON TRUE
      WHERE c."organizationId"=${organizationId}::uuid AND c."archivedAt" IS NULL
        AND (${managedClientId}::uuid IS NULL OR c.id=${managedClientId}::uuid)
      ORDER BY COALESCE(us."lastSeenAt",c."createdAt") DESC
      LIMIT 1000
    `;
  }

  private relations(organizationId: string, managedClientId: string | null) {
    return this.prisma.$queryRaw<any[]>`
      SELECT sc.id,sc.status::text AS status,sc.subject,sc."lastMessageAt",sc."createdAt" AS "startedAt",sc."resolvedAt" AS "endedAt",
        sc."assignedToUserId" AS "agentId",requester."managedClientId" AS "clientId",
        'SUPPORT'::text AS "assignmentType",'support'::text AS channel,
        CASE WHEN sc.status='HANDOFF_REQUESTED' THEN 'HIGH' ELSE 'NORMAL' END AS priority,
        (sc.status='HANDOFF_REQUESTED' OR sc."lastMessageAt"<CURRENT_TIMESTAMP-INTERVAL '15 minutes') AS "slaRisk"
      FROM "SupportConversation" sc JOIN "User" requester ON requester.id=sc."requesterUserId"
      WHERE sc."organizationId"=${organizationId}::uuid AND sc."assignedToUserId" IS NOT NULL AND requester."managedClientId" IS NOT NULL
        AND (${managedClientId}::uuid IS NULL OR requester."managedClientId"=${managedClientId}::uuid)
        AND sc.status IN ('ASSIGNED','HANDOFF_REQUESTED')
      ORDER BY "slaRisk" DESC,sc."lastMessageAt" DESC
      LIMIT 250
    `;
  }

  private liveVisitors(organizationId: string) {
    return this.prisma.$queryRaw<any[]>`
      WITH latest_sessions AS (
        SELECT DISTINCT ON ("sessionId")
          md5("sessionId") AS id,"eventType",upper(left("countryCode",2)) "countryCode","regionCode",municipality,
          round(latitude::numeric,1)::float8 latitude,round(longitude::numeric,1)::float8 longitude,
          "createdAt" AS "lastSeenAt",left(COALESCE(metadata->>'path','/'),160) AS "pagePath"
        FROM "MarketingAnalyticsEvent"
        WHERE "organizationId"=${organizationId}::uuid AND consent=TRUE AND "sessionId" IS NOT NULL
          AND "createdAt">=CURRENT_TIMESTAMP-INTERVAL '5 minutes'
        ORDER BY "sessionId","createdAt" DESC
      )
      SELECT id,"countryCode","regionCode",municipality,latitude,longitude,"lastSeenAt","pagePath"
      FROM latest_sessions
      WHERE "eventType"<>'SESSION_ENDED'
        AND "lastSeenAt">=CURRENT_TIMESTAMP-${LIVE_VISITOR_TTL_SECONDS}*INTERVAL '1 second'
      ORDER BY "lastSeenAt" DESC
      LIMIT 500
    `;
  }

  private growth(organizationId: string, windowDays: number) {
    return this.prisma.$queryRaw<any[]>`
      WITH visitor_stage AS (
        SELECT "anonymousId",upper(left("countryCode",2)) "countryCode","regionCode",municipality,
          round(avg(latitude)::numeric,1)::float8 latitude,round(avg(longitude)::numeric,1)::float8 longitude,count(*)::int events,
          CASE WHEN bool_or("eventType"='CHECKOUT_COMPLETED') THEN 4 WHEN bool_or("eventType"='CHECKOUT_STARTED') THEN 3
            WHEN bool_or("eventType"='PLAN_SELECTED') THEN 2 WHEN count(*)>1 THEN 1 ELSE 0 END stage
        FROM "MarketingAnalyticsEvent"
        WHERE "organizationId"=${organizationId}::uuid AND consent=TRUE AND "anonymousId" IS NOT NULL
          AND latitude IS NOT NULL AND longitude IS NOT NULL AND "createdAt">=CURRENT_TIMESTAMP-${windowDays}*INTERVAL '1 day'
        GROUP BY "anonymousId",upper(left("countryCode",2)),"regionCode",municipality
      )
      SELECT "countryCode","regionCode",municipality,round(avg(latitude)::numeric,1)::float8 latitude,round(avg(longitude)::numeric,1)::float8 longitude,
        sum(events)::int events,count(*)::int visitors,count(*) FILTER(WHERE stage=0)::int "visitorCount",count(*) FILTER(WHERE stage=1)::int "engagedCount",
        count(*) FILTER(WHERE stage=2)::int "leadCount",count(*) FILTER(WHERE stage=3)::int "prospectCount",count(*) FILTER(WHERE stage=4)::int "clientCount"
      FROM visitor_stage GROUP BY "countryCode","regionCode",municipality ORDER BY visitors DESC,events DESC LIMIT 250
    `;
  }

  private growthSummary(organizationId: string, windowDays: number) {
    return this.prisma.$queryRaw<any[]>`
      SELECT count(*) FILTER(WHERE "eventType"='PAGE_VIEW')::int visits,
        count(DISTINCT "anonymousId") FILTER(WHERE "anonymousId" IS NOT NULL)::int visitors,
        count(*) FILTER(WHERE "eventType"='PLAN_SELECTED')::int "planSelections",
        count(*) FILTER(WHERE "eventType"='CHECKOUT_STARTED')::int checkouts,
        count(*) FILTER(WHERE "eventType"='CHECKOUT_COMPLETED')::int conversions
      FROM "MarketingAnalyticsEvent" WHERE "organizationId"=${organizationId}::uuid AND "createdAt">=CURRENT_TIMESTAMP-${windowDays}*INTERVAL '1 day'
    `;
  }

  private async buildOverview(user: AuthenticatedUser, request: GlobeRequest, scope: GlobeAccessScope): Promise<Record<string, unknown>> {
    const strategy = await this.strategy(scope.organizationId);
    const includeClients = ['clients', 'relations', 'all'].includes(request.mode);
    const includeRelations = ['relations', 'all'].includes(request.mode);
    const anonymousGeographyEnabled = !scope.managedClientId && strategy.enabled && strategy.geoSegmentationEnabled && strategy.anonymousAnalyticsEnabled;
    const includeLiveVisitors = anonymousGeographyEnabled && ['visitors', 'all'].includes(request.mode);
    const growthEnabled = anonymousGeographyEnabled;
    const includeGrowth = growthEnabled && ['growth', 'all'].includes(request.mode);
    const windowDays = request.window === 'real-time' ? 1 : request.windowDays;

    const [clientRows, relationRows, liveVisitorRows, growthRows, summaryRows] = await Promise.all([
      includeClients ? this.clients(scope.organizationId, windowDays, scope.managedClientId) : Promise.resolve([]),
      includeRelations ? this.relations(scope.organizationId, scope.managedClientId) : Promise.resolve([]),
      includeLiveVisitors ? this.liveVisitors(scope.organizationId) : Promise.resolve([]),
      includeGrowth ? this.growth(scope.organizationId, windowDays) : Promise.resolve([]),
      includeGrowth ? this.growthSummary(scope.organizationId, windowDays) : Promise.resolve([]),
    ]);

    const clients = clientRows.map((row) => {
      const seconds = Number(row.totalConnectedSeconds || 0);
      const connectionCount = Number(row.connectionCount || 0);
      const activeDays = Number(row.activeDays || 0);
      const eventCount = Number(row.eventCount || 0);
      const stationSessionCount = Number(row.stationSessionCount || 0);
      return {
        ...row,
        lastCountryCode: normalizeCountryCode(row.lastCountryCode),
        lastLatitude: roundCoordinate(row.lastLatitude),
        lastLongitude: roundCoordinate(row.lastLongitude),
        totalConnectedSeconds: seconds,
        online: Boolean(row.lastSeenAt && Date.now() - new Date(row.lastSeenAt).getTime() < 90_000),
        regular: connectionCount >= strategy.regularClientMinSessions && activeDays >= strategy.regularClientMinActiveDays && seconds >= strategy.regularClientMinMinutes * 60,
        engagementScore: Math.min(100, Math.round(connectionCount * 5 + eventCount * 12 + stationSessionCount * 2 + Math.min(30, (seconds / 3600) * 3))),
      };
    });
    const liveVisitors = liveVisitorRows.map((row) => ({
      id: String(row.id),
      online: true,
      source: 'PROMOTIONAL_SITE',
      countryCode: normalizeCountryCode(row.countryCode),
      regionCode: row.regionCode ?? null,
      municipality: row.municipality ?? null,
      latitude: roundCoordinate(row.latitude),
      longitude: roundCoordinate(row.longitude),
      lastSeenAt: row.lastSeenAt,
      pagePath: typeof row.pagePath === 'string' ? row.pagePath.slice(0, 160) : '/',
    }));
    const geographies = growthRows.map((row) => {
      const stages = {
        visitor: Number(row.visitorCount || 0), engaged: Number(row.engagedCount || 0), lead: Number(row.leadCount || 0),
        prospect: Number(row.prospectCount || 0), client: Number(row.clientCount || 0),
      };
      const dominantStage = (['client', 'prospect', 'lead', 'engaged', 'visitor'] as const).find((stage) => stages[stage] > 0) ?? 'visitor';
      return { ...row, countryCode: normalizeCountryCode(row.countryCode), latitude: roundCoordinate(row.latitude), longitude: roundCoordinate(row.longitude), events: Number(row.events || 0), visitors: Number(row.visitors || 0), stages, dominantStage };
    });

    return {
      generatedAt: new Date().toISOString(),
      mode: request.mode,
      window: request.window,
      capabilities: {
        canViewAll: user.role === UserRole.OWNER && !scope.managedClientId,
        managedAccount: Boolean(scope.managedClientId),
        accountPlan: scope.accountPlan,
        contactScope: scope.managedClientId ? 'SELF_AND_ASSIGNED_AGENTS' : 'ORGANIZATION',
      },
      clients,
      relations: relationRows,
      liveVisitors: {
        enabled: anonymousGeographyEnabled,
        ttlSeconds: LIVE_VISITOR_TTL_SECONDS,
        items: liveVisitors,
      },
      growth: {
        enabled: growthEnabled,
        disabledReason: growthEnabled ? null : 'L’analytics géographique pseudonymisée est désactivée.',
        geographies,
        summary: summaryRows[0] ?? { visits: 0, visitors: 0, planSelections: 0, checkouts: 0, conversions: 0 },
      },
    };
  }
}
