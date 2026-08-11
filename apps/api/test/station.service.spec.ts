import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { EventsService } from '../src/events/events.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StationService } from '../src/station/station.service';

jest.mock('argon2', () => ({ verify: jest.fn() }));

describe('StationService', () => {
  const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const eventId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const activationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const now = new Date();

  const activation = {
    id: activationId,
    organizationId,
    eventId,
    codeHash: 'hashed-code',
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
    usedAt: null,
    revokedAt: null,
    createdAt: now,
  };

  const manifest = {
    version: 1 as const,
    event: {
      id: eventId,
      name: 'Capture Test',
      startsAt: now,
      endsAt: null,
      venueName: null,
      venueAddress: null,
      status: 'ACTIVE' as const,
    },
    preset: null,
    organization: { id: organizationId, name: 'KHE' },
    capabilities: { capture: true as const, sharing: true as const, formats: ['9:16', '1:1'] },
  };

  const prisma = {
    eventActivation: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  } as unknown as PrismaService;

  const jwt = { sign: jest.fn() } as unknown as JwtService;
  const events = { manifest: jest.fn() } as unknown as EventsService;
  const service = new StationService(prisma, jwt, events);
  const verifyMock = argon2.verify as jest.MockedFunction<typeof argon2.verify>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STATION_TOKEN_EXPIRES_IN_SECONDS = '604800';
  });

  it('claims a valid activation exactly once and returns a station token plus manifest', async () => {
    jest.spyOn(prisma.eventActivation, 'findMany').mockResolvedValue([activation]);
    verifyMock.mockResolvedValue(true);
    jest.spyOn(prisma.eventActivation, 'updateMany').mockResolvedValue({ count: 1 });
    jest.spyOn(jwt, 'sign').mockReturnValue('station-token');
    jest.spyOn(events, 'manifest').mockResolvedValue(manifest);

    const result = await service.activate('KHE-123456');

    expect(verifyMock).toHaveBeenCalledWith('hashed-code', 'KHE-123456');
    expect(prisma.eventActivation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: activationId,
        usedAt: null,
        revokedAt: null,
      }),
      data: { usedAt: expect.any(Date) },
    });
    expect(jwt.sign).toHaveBeenCalledWith(
      {
        sub: eventId,
        type: 'station',
        organizationId,
        eventId,
        scope: 'CAPTURE',
      },
      { expiresIn: 604800 },
    );
    expect(result.stationToken).toBe('station-token');
    expect(result.manifest).toBe(manifest);
  });

  it('rejects an invalid or expired activation code', async () => {
    jest.spyOn(prisma.eventActivation, 'findMany').mockResolvedValue([activation]);
    verifyMock.mockResolvedValue(false);

    await expect(service.activate('KHE-654321')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.eventActivation.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a replay when the activation was claimed concurrently', async () => {
    jest.spyOn(prisma.eventActivation, 'findMany').mockResolvedValue([activation]);
    verifyMock.mockResolvedValue(true);
    jest.spyOn(prisma.eventActivation, 'updateMany').mockResolvedValue({ count: 0 });

    await expect(service.activate('KHE-123456')).rejects.toThrow('Activation code already used');
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
