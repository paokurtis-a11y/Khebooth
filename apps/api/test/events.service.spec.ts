import { EventStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { EventsService } from '../src/events/events.service';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('argon2', () => ({ hash: jest.fn() }));

describe('EventsService activation and manifest', () => {
  const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const eventId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const startsAt = new Date('2026-08-11T18:00:00.000Z');

  const preset = {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    organizationId,
    name: 'Portrait MVP',
    aspectRatio: 'PORTRAIT_9_16' as const,
    configuration: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const eventRecord = {
    id: eventId,
    organizationId,
    clientId: null,
    presetId: preset.id,
    name: 'Mariage test',
    description: null,
    startsAt,
    endsAt: null,
    venueName: 'Salle test',
    venueAddress: null,
    status: EventStatus.READY,
    createdAt: new Date(),
    updatedAt: new Date(),
    client: null,
    preset,
  };

  const prisma = {
    event: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    eventActivation: {
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    organization: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const service = new EventsService(prisma);
  const hashMock = argon2.hash as jest.MockedFunction<typeof argon2.hash>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(prisma.event, 'findFirst').mockResolvedValue(eventRecord);
  });

  it('stores only the activation code hash and revokes previous active codes', async () => {
    hashMock.mockResolvedValue('hashed-activation-code');
    jest.spyOn(prisma.eventActivation, 'updateMany').mockResolvedValue({ count: 1 });
    jest.spyOn(prisma.eventActivation, 'create').mockResolvedValue({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      organizationId,
      eventId,
      codeHash: 'hashed-activation-code',
      expiresAt: new Date(),
      usedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });
    jest.spyOn(prisma.event, 'update').mockResolvedValue({ ...eventRecord, status: EventStatus.ACTIVE });
    jest.spyOn(prisma.auditLog, 'create').mockResolvedValue({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      organizationId,
      userId,
      action: 'EVENT_ACTIVATED',
      entityType: 'Event',
      entityId: eventId,
      metadata: null,
      createdAt: new Date(),
    });
    jest.spyOn(prisma, '$transaction').mockResolvedValue([] as never);

    const before = Date.now();
    const result = await service.activate(organizationId, userId, eventId);
    const after = Date.now();

    expect(result.code).toMatch(/^KHE-\d{6}$/);
    expect(hashMock).toHaveBeenCalledWith(result.code);
    expect(prisma.eventActivation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId,
        eventId,
        codeHash: 'hashed-activation-code',
      }),
    });
    expect(prisma.eventActivation.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ codeHash: result.code }) }),
    );
    expect(prisma.eventActivation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ organizationId, eventId, usedAt: null, revokedAt: null }),
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 15 * 60 * 1000);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 15 * 60 * 1000);
  });

  it('returns a versioned manifest without Prisma organization metadata on the preset', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
      id: organizationId,
      name: 'Kurtis Hypnotic Events',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const manifest = await service.manifest(organizationId, eventId);

    expect(manifest.version).toBe(1);
    expect(manifest.capabilities.formats).toEqual(['9:16', '1:1']);
    expect(manifest.preset).toEqual({
      id: preset.id,
      name: preset.name,
      aspectRatio: preset.aspectRatio,
      configuration: preset.configuration,
    });
    expect(manifest.preset).not.toHaveProperty('organizationId');
    expect(manifest.preset).not.toHaveProperty('createdAt');
  });
});
