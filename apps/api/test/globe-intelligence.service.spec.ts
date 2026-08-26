import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../src/auth/auth.types';
import {
  GlobeIntelligenceService,
  LIVE_VISITOR_TTL_SECONDS,
  normalizeCountryCode,
  parseGlobeRequest,
  roundCoordinate,
} from '../src/operations/globe-intelligence.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GlobeIntelligenceService', () => {
  const owner: AuthenticatedUser = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    organizationId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    email: 'owner@khe.test',
    role: UserRole.OWNER,
  };
  const admin: AuthenticatedUser = { ...owner, id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', role: UserRole.ADMIN };
  const business: AuthenticatedUser = { ...admin, organizationId:'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', email:'business@client.test' };
  const activeBusiness = {
    managedClientId:'dddddddd-dddd-dddd-dddd-dddddddddddd',
    clientOrganizationId:owner.organizationId,
    subscriptionPlan:'BUSINESS',
    subscriptionStatus:'ACTIVE',
    paymentStatus:'PAID',
    subscriptionEndsAt:null,
  };

  it('normalizes only valid ISO-2 country codes and rounds approximate coordinates', () => {
    expect(normalizeCountryCode(' ch ')).toBe('CH');
    expect(normalizeCountryCode('CHE')).toBeNull();
    expect(roundCoordinate(46.948091)).toBe(46.95);
    expect(roundCoordinate(undefined)).toBeNull();
  });

  it('rejects unknown modes and windows', () => {
    expect(() => parseGlobeRequest('unknown', '1d', UserRole.OWNER)).toThrow(BadRequestException);
    expect(() => parseGlobeRequest('agents', '90d', UserRole.OWNER)).toThrow(BadRequestException);
  });

  it('reserves the all-layers view to the OWNER on the server', () => {
    expect(() => parseGlobeRequest('all', '7d', UserRole.ADMIN)).toThrow(ForbiddenException);
    expect(parseGlobeRequest('all', '7d', UserRole.OWNER)).toMatchObject({ mode: 'all', window: '7d', windowDays: 7 });
  });

  it('loads only the requested layer and sanitizes client geography', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          enabled: true,
          analysisWindowDays: 30,
          highIntentScore: 60,
          regularClientMinSessions: 2,
          regularClientMinActiveDays: 1,
          regularClientMinMinutes: 10,
          geoSegmentationEnabled: true,
          anonymousAnalyticsEnabled: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          name: 'Client Suisse',
          connectionCount: 3,
          activeDays: 2,
          totalConnectedSeconds: BigInt(7200),
          eventCount: 1,
          stationSessionCount: 2,
          lastCountryCode: 'ch',
          lastLatitude: 46.948091,
          lastLongitude: 7.44744,
          lastSeenAt: new Date(),
        },
      ]);
    const prisma = { $queryRaw: query } as unknown as PrismaService;
    const service = new GlobeIntelligenceService(prisma);

    const result = (await service.overview(owner, 'clients', '1d')) as any;

    expect(query).toHaveBeenCalledTimes(3);
    expect(result.mode).toBe('clients');
    expect(result.clients[0]).toMatchObject({ lastCountryCode: 'CH', lastLatitude: 46.95, lastLongitude: 7.45, online: true, regular: true });
    expect(result.relations).toEqual([]);
    expect(result.growth.geographies).toEqual([]);
  });

  it('returns only consented live promotional sessions as anonymous visitor points', async () => {
    const seenAt = new Date();
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        enabled:true,
        geoSegmentationEnabled:true,
        anonymousAnalyticsEnabled:true,
      }])
      .mockResolvedValueOnce([{
        id:'5f4dcc3b5aa765d61d8327deb882cf99',
        countryCode:'ch',
        regionCode:'FR',
        municipality:'Fribourg',
        latitude:46.9,
        longitude:7.4,
        lastSeenAt:seenAt,
        pagePath:'/',
      }]);
    const prisma = { $queryRaw:query } as unknown as PrismaService;
    const result = await new GlobeIntelligenceService(prisma).overview(owner, 'visitors', 'real-time') as any;

    expect(LIVE_VISITOR_TTL_SECONDS).toBe(75);
    expect(result.liveVisitors).toMatchObject({ enabled:true, ttlSeconds:75 });
    expect(result.liveVisitors.items).toEqual([expect.objectContaining({
      id:'5f4dcc3b5aa765d61d8327deb882cf99',
      online:true,
      source:'PROMOTIONAL_SITE',
      countryCode:'CH',
      municipality:'Fribourg',
      latitude:46.9,
      longitude:7.4,
      pagePath:'/',
    })]);
    expect(result.clients).toEqual([]);
    expect(result.growth.geographies).toEqual([]);
  });

  it('uses a short cache to avoid repeating the same aggregated database work', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const prisma = { $queryRaw: query } as unknown as PrismaService;
    const service = new GlobeIntelligenceService(prisma);

    const first = await service.overview(admin, 'agents', 'real-time');
    const second = await service.overview(admin, 'agents', 'real-time');

    expect(second).toBe(first);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('authorizes a paid active BUSINESS account with a managed scope', async () => {
    const query = jest.fn().mockResolvedValueOnce([activeBusiness]).mockResolvedValueOnce([]);
    const prisma = { $queryRaw: query } as unknown as PrismaService;
    const service = new GlobeIntelligenceService(prisma);

    const result = await service.overview(business, 'agents', 'real-time') as any;

    expect(result.capabilities).toMatchObject({ managedAccount:true, accountPlan:'BUSINESS', contactScope:'SELF_AND_ASSIGNED_AGENTS', canViewAll:false });
    expect(result.growth.enabled).toBe(false);
  });

  it('rejects live visitors, Growth and unpaid BUSINESS access', async () => {
    const visitorPrisma = { $queryRaw:jest.fn().mockResolvedValueOnce([activeBusiness]) } as unknown as PrismaService;
    await expect(new GlobeIntelligenceService(visitorPrisma).overview(business, 'visitors', 'real-time')).rejects.toThrow(ForbiddenException);

    const growthPrisma = { $queryRaw:jest.fn().mockResolvedValueOnce([activeBusiness]) } as unknown as PrismaService;
    await expect(new GlobeIntelligenceService(growthPrisma).overview(business, 'growth', 'real-time')).rejects.toThrow(ForbiddenException);

    const unpaidPrisma = { $queryRaw:jest.fn().mockResolvedValueOnce([{ ...activeBusiness, paymentStatus:'PENDING' }]) } as unknown as PrismaService;
    await expect(new GlobeIntelligenceService(unpaidPrisma).overview(business, 'agents', 'real-time')).rejects.toThrow(ForbiddenException);
  });
});
