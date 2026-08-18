import { JwtService } from '@nestjs/jwt';
import { StationMode } from '@prisma/client';
import { EventsService } from '../src/events/events.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StationRenewalService } from '../src/stations/station-renewal.service';

const findFirst = jest.fn();
const update = jest.fn();
const createAuditLog = jest.fn();
const verifyAsync = jest.fn();
const signAsync = jest.fn();
const manifest = jest.fn();

const prisma = {
  stationSession: { findFirst, update },
  auditLog: { create: createAuditLog },
} as unknown as PrismaService;

const jwt = { verifyAsync, signAsync } as unknown as JwtService;
const events = { manifest } as unknown as EventsService;

const service = new StationRenewalService(prisma, jwt, events);

describe('StationRenewalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renews a token without re-signing exp, iat or sub from the previous JWT', async () => {
    const session = {
      id: '11111111-1111-1111-1111-111111111111',
      organizationId: '22222222-2222-2222-2222-222222222222',
      eventId: '33333333-3333-3333-3333-333333333333',
      deviceId: '44444444-4444-4444-4444-444444444444',
      mode: StationMode.SHARING,
      expiresAt: new Date(Date.now() + 60_000),
    };

    verifyAsync.mockResolvedValue({
      typ: 'station',
      sessionId: session.id,
      organizationId: session.organizationId,
      eventId: session.eventId,
      deviceId: session.deviceId,
      mode: session.mode,
      sub: session.id,
      iat: 1_700_000_000,
      exp: 1_700_000_100,
    });
    findFirst.mockResolvedValue(session);
    update.mockImplementation(async ({ data }: { data: { expiresAt: Date } }) => ({
      ...session,
      expiresAt: data.expiresAt,
    }));
    signAsync.mockResolvedValue('renewed-station-token');
    manifest.mockResolvedValue({ event: { id: session.eventId } });
    createAuditLog.mockResolvedValue({ id: 'audit-id' });

    const result = await service.renew('Bearer previous-station-token');

    expect(verifyAsync).toHaveBeenCalledWith('previous-station-token', { ignoreExpiration: true });
    expect(signAsync).toHaveBeenCalledWith(
      {
        typ: 'station',
        sessionId: session.id,
        organizationId: session.organizationId,
        eventId: session.eventId,
        deviceId: session.deviceId,
        mode: session.mode,
      },
      {
        subject: session.id,
        expiresIn: 30 * 24 * 60 * 60,
      },
    );

    const signedPayload = signAsync.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(signedPayload).not.toHaveProperty('exp');
    expect(signedPayload).not.toHaveProperty('iat');
    expect(signedPayload).not.toHaveProperty('sub');
    expect(result.stationToken).toBe('renewed-station-token');
  });
});
