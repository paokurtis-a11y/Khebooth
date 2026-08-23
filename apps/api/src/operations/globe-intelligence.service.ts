import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type StrategyThresholds = {
  analysisWindowDays: number;
  regularClientMinSessions: number;
  regularClientMinActiveDays: number;
  regularClientMinMinutes: number;
};

@Injectable()
export class GlobeIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: AuthenticatedUser) {
    const strategyRows = await this.prisma.$queryRaw<StrategyThresholds[]>`
      SELECT
        COALESCE("analysisWindowDays", 30)::int AS "analysisWindowDays",
        COALESCE("regularClientMinSessions", 5)::int AS "regularClientMinSessions",
        COALESCE("regularClientMinActiveDays", 3)::int AS "regularClientMinActiveDays",
        COALESCE("regularClientMinMinutes", 60)::int AS "regularClientMinMinutes"
      FROM "GrowthStrategyConfig"
      WHERE "organizationId"=${user.organizationId}::uuid
      LIMIT 1
    `;
    const strategy = strategyRows[0] ?? {
      analysisWindowDays: 30,
      regularClientMinSessions: 5,
      regularClientMinActiveDays: 3,
      regularClientMinMinutes: 60,
    };

    const [clients, relations, growth, summaryRows] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT
          c.id,c.name,c.email,c."companyName",
          COALESCE(us.sessions,0)::int AS "connectionCount",
          COALESCE(us.days,0)::int AS "activeDays",
          COALESCE(us.seconds,0)::bigint AS "totalConnectedSeconds",
          us."lastSeenAt",
          us."lastCountryCode",us."lastRegionCode",us."lastMunicipality",
          us."lastLatitude",us."lastLongitude",
          COALESCE(ev.events,0)::int AS "eventCount",
          COALESCE(st.sessions,0)::int AS "stationSessionCount"
        FROM "Client" c
        LEFT JOIN LATERAL (
          SELECT
            count(*) sessions,
            count(DISTINCT "startedAt"::date) days,
            COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE("endedAt","lastSeenAt")-"startedAt"))),0) seconds,
            max("lastSeenAt") "lastSeenAt",
            (array_agg("countryCode" ORDER BY "lastSeenAt" DESC) FILTER(WHERE "countryCode" IS NOT NULL))[1] "lastCountryCode",
            (array_agg("regionCode" ORDER BY "lastSeenAt" DESC) FILTER(WHERE "regionCode" IS NOT NULL))[1] "lastRegionCode",
            (array_agg(municipality ORDER BY "lastSeenAt" DESC) FILTER(WHERE municipality IS NOT NULL))[1] "lastMunicipality",
            (array_agg(latitude ORDER BY "lastSeenAt" DESC) FILTER(WHERE latitude IS NOT NULL AND "locationSharingEnabled"=TRUE))[1] "lastLatitude",
            (array_agg(longitude ORDER BY "lastSeenAt" DESC) FILTER(WHERE longitude IS NOT NULL AND "locationSharingEnabled"=TRUE))[1] "lastLongitude"
          FROM "UserActivitySession"
          WHERE "clientId"=c.id
        ) us ON TRUE
        LEFT JOIN LATERAL (SELECT count(*) events FROM "Event" WHERE "clientId"=c.id) ev ON TRUE
        LEFT JOIN LATERAL (
          SELECT count(*) sessions
          FROM "StationSession" ss
          JOIN "Event" e ON e.id=ss."eventId"
          WHERE e."clientId"=c.id
        ) st ON TRUE
        WHERE c."organizationId"=${user.organizationId}::uuid
        ORDER BY COALESCE(us."lastSeenAt",c."createdAt") DESC
        LIMIT 500
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT
          sc.id,
          sc.status::text AS status,
          sc.subject,
          sc."lastMessageAt",
          sc."createdAt",
          sc."assignedToUserId" AS "agentId",
          requester."managedClientId" AS "clientId"
        FROM "SupportConversation" sc
        JOIN "User" requester ON requester.id=sc."requesterUserId"
        WHERE sc."organizationId"=${user.organizationId}::uuid
          AND sc."assignedToUserId" IS NOT NULL
          AND requester."managedClientId" IS NOT NULL
          AND sc.status IN ('ASSIGNED','HANDOFF_REQUESTED')
        ORDER BY sc."lastMessageAt" DESC
        LIMIT 250
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT
          "countryCode","regionCode",municipality,
          round(avg(latitude)::numeric,4)::float8 latitude,
          round(avg(longitude)::numeric,4)::float8 longitude,
          count(*)::int events,
          count(DISTINCT "anonymousId")::int visitors
        FROM "MarketingAnalyticsEvent"
        WHERE "organizationId"=${user.organizationId}::uuid
          AND consent=TRUE
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND "createdAt">=CURRENT_TIMESTAMP-${strategy.analysisWindowDays}*INTERVAL '1 day'
        GROUP BY "countryCode","regionCode",municipality
        ORDER BY visitors DESC,events DESC
        LIMIT 120
      `,
      this.prisma.$queryRaw<any[]>`
        SELECT
          count(*) FILTER(WHERE "eventType"='PAGE_VIEW')::int visits,
          count(DISTINCT "anonymousId") FILTER(WHERE "anonymousId" IS NOT NULL)::int visitors,
          count(*) FILTER(WHERE "eventType"='PLAN_SELECTED')::int "planSelections",
          count(*) FILTER(WHERE "eventType"='CHECKOUT_STARTED')::int checkouts,
          count(*) FILTER(WHERE "eventType"='CHECKOUT_COMPLETED')::int conversions
        FROM "MarketingAnalyticsEvent"
        WHERE "organizationId"=${user.organizationId}::uuid
          AND "createdAt">=CURRENT_TIMESTAMP-${strategy.analysisWindowDays}*INTERVAL '1 day'
      `,
    ]);

    const normalizedClients = clients.map((row) => {
      const seconds = Number(row.totalConnectedSeconds || 0);
      const connectionCount = Number(row.connectionCount || 0);
      const activeDays = Number(row.activeDays || 0);
      const eventCount = Number(row.eventCount || 0);
      const stationSessionCount = Number(row.stationSessionCount || 0);
      return {
        ...row,
        totalConnectedSeconds: seconds,
        lastLatitude: row.lastLatitude === null ? null : Number(row.lastLatitude),
        lastLongitude: row.lastLongitude === null ? null : Number(row.lastLongitude),
        online: Boolean(row.lastSeenAt && Date.now() - new Date(row.lastSeenAt).getTime() < 90_000),
        regular:
          connectionCount >= strategy.regularClientMinSessions &&
          activeDays >= strategy.regularClientMinActiveDays &&
          seconds >= strategy.regularClientMinMinutes * 60,
        engagementScore: Math.min(
          100,
          Math.round(connectionCount * 5 + eventCount * 12 + stationSessionCount * 2 + Math.min(30, (seconds / 3600) * 3)),
        ),
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      clients: normalizedClients,
      relations,
      growth: {
        geographies: growth,
        summary: summaryRows[0] ?? { visits: 0, visitors: 0, planSelections: 0, checkouts: 0, conversions: 0 },
      },
    };
  }
}
