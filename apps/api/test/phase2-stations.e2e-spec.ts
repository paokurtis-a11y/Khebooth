import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventStatus, StationMode, UserRole } from '@prisma/client';
import { head } from '@vercel/blob';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('@vercel/blob', () => ({
  head: jest.fn(),
  issueSignedToken: jest.fn(),
  presignUrl: jest.fn(),
}));

const mockHead = jest.mocked(head);
const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = integrationEnabled ? describe : describe.skip;

suite('Phase 2 station and synchronization foundation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationAId: string;
  let organizationBId: string;
  let eventAId: string;
  let eventBId: string;
  let ownerToken: string;
  const password = 'Phase2-Test-Password!2026';
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    const organizationA = await prisma.organization.create({ data: { name: `Phase2 A ${suffix}` } });
    const organizationB = await prisma.organization.create({ data: { name: `Phase2 B ${suffix}` } });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const passwordHash = await argon2.hash(password);
    const owner = await prisma.user.create({
      data: {
        organizationId: organizationAId,
        email: `phase2-owner-${suffix}@example.com`,
        passwordHash,
        role: UserRole.OWNER,
      },
    });

    const eventA = await prisma.event.create({
      data: {
        organizationId: organizationAId,
        name: 'Phase 2 event A',
        startsAt: new Date('2026-08-12T18:00:00.000Z'),
        status: EventStatus.READY,
      },
    });
    const eventB = await prisma.event.create({
      data: {
        organizationId: organizationBId,
        name: 'Phase 2 event B',
        startsAt: new Date('2026-08-12T18:00:00.000Z'),
        status: EventStatus.ACTIVE,
      },
    });
    eventAId = eventA.id;
    eventBId = eventB.id;

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: owner.email, password })
      .expect(201);
    ownerToken = login.body.accessToken as string;
  });

  beforeEach(() => {
    mockHead.mockReset();
  });

  afterAll(async () => {
    if (prisma && organizationAId && organizationBId) {
      const organizationIds = [organizationAId, organizationBId];
      await prisma.uploadSession.deleteMany({
        where: { mediaAsset: { organizationId: { in: organizationIds } } },
      });
      await prisma.mediaAsset.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.stationSession.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.device.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.eventActivation.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.event.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    if (app) await app.close();
  });

  function userAuth() {
    return { Authorization: `Bearer ${ownerToken}` };
  }

  function stationAuth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function activateEvent() {
    return request(app.getHttpServer())
      .post(`/api/events/${eventAId}/activate`)
      .set(userAuth())
      .expect(201);
  }

  it('rejects invalid, expired, revoked and cross-event activation codes', async () => {
    await request(app.getHttpServer())
      .post('/api/stations/redeem')
      .send({
        eventId: eventAId,
        code: 'KHE-000000',
        installationId: `invalid-${suffix}`,
        mode: StationMode.CAPTURE,
      })
      .expect(401);

    const expiredCode = 'KHE-111111';
    await prisma.eventActivation.create({
      data: {
        organizationId: organizationAId,
        eventId: eventAId,
        codeHash: await argon2.hash(expiredCode),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await request(app.getHttpServer())
      .post('/api/stations/redeem')
      .send({ eventId: eventAId, code: expiredCode, installationId: `expired-${suffix}`, mode: StationMode.CAPTURE })
      .expect(401);

    const revokedCode = 'KHE-222222';
    await prisma.eventActivation.create({
      data: {
        organizationId: organizationAId,
        eventId: eventAId,
        codeHash: await argon2.hash(revokedCode),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      },
    });
    await request(app.getHttpServer())
      .post('/api/stations/redeem')
      .send({ eventId: eventAId, code: revokedCode, installationId: `revoked-${suffix}`, mode: StationMode.CAPTURE })
      .expect(401);

    const active = await activateEvent();
    await request(app.getHttpServer())
      .post('/api/stations/redeem')
      .send({
        eventId: eventBId,
        code: active.body.code,
        installationId: `cross-${suffix}`,
        mode: StationMode.CAPTURE,
      })
      .expect(401);
  });

  it('joins two tablets, preserves mode uniqueness and synchronizes idempotently', async () => {
    const activation = await activateEvent();
    const code = activation.body.code as string;

    const capture = await request(app.getHttpServer())
      .post('/api/stations/redeem')
      .send({
        eventId: eventAId,
        code,
        installationId: `capture-${suffix}`,
        deviceName: 'Capture tablet',
        platform: 'test',
        mode: StationMode.CAPTURE,
      })
      .expect(201);
    const captureToken = capture.body.stationToken as string;
    expect(capture.body.session.mode).toBe(StationMode.CAPTURE);
    expect(capture.body.manifest.event.id).toBe(eventAId);
    expect(capture.body.manifest.mediaPolicy.offlineFirst).toBe(true);

    const captureRetry = await request(app.getHttpServer())
      .post('/api/stations/redeem')
      .send({ eventId: eventAId, code, installationId: `capture-${suffix}`, mode: StationMode.CAPTURE })
      .expect(201);
    expect(captureRetry.body.session.id).toBe(capture.body.session.id);

    await request(app.getHttpServer())
      .post('/api/stations/redeem')
      .send({ eventId: eventAId, code, installationId: `other-capture-${suffix}`, mode: StationMode.CAPTURE })
      .expect(409);

    const sharing = await request(app.getHttpServer())
      .post('/api/stations/redeem')
      .send({
        eventId: eventAId,
        code,
        installationId: `sharing-${suffix}`,
        deviceName: 'Sharing tablet',
        platform: 'test',
        mode: StationMode.SHARING,
      })
      .expect(201);
    const sharingToken = sharing.body.stationToken as string;
    expect(sharing.body.session.mode).toBe(StationMode.SHARING);

    const consumedActivation = await prisma.eventActivation.findFirstOrThrow({
      where: { eventId: eventAId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(consumedActivation.usedAt).toBeInstanceOf(Date);

    const mediaPayload = {
      localId: `local-${suffix}`,
      idempotencyKey: `idem-${suffix}`,
      contentHash: `sha256:${suffix}`,
      byteSize: 1000,
      mimeType: 'video/mp4',
      capturedAt: '2026-08-12T18:30:00.000Z',
    };
    const created = await request(app.getHttpServer())
      .post('/api/stations/media')
      .set(stationAuth(captureToken))
      .send(mediaPayload)
      .expect(201);
    const mediaId = created.body.id as string;

    const replay = await request(app.getHttpServer())
      .post('/api/stations/media')
      .set(stationAuth(captureToken))
      .send(mediaPayload)
      .expect(201);
    expect(replay.body.id).toBe(mediaId);

    await request(app.getHttpServer())
      .post('/api/stations/media')
      .set(stationAuth(sharingToken))
      .send({ ...mediaPayload, localId: `sharing-local-${suffix}`, idempotencyKey: `sharing-idem-${suffix}` })
      .expect(403);

    const beforeSync = await request(app.getHttpServer())
      .get('/api/stations/media')
      .set(stationAuth(sharingToken))
      .expect(200);
    expect(beforeSync.body).toHaveLength(0);

    const upload = await request(app.getHttpServer())
      .post(`/api/stations/media/${mediaId}/upload`)
      .set(stationAuth(captureToken))
      .expect(201);
    expect(upload.body.uploadedBytes).toBe(0);

    await request(app.getHttpServer())
      .patch(`/api/stations/media/${mediaId}/upload`)
      .set(stationAuth(captureToken))
      .send({ uploadedBytes: 400 })
      .expect(200);

    const resumed = await request(app.getHttpServer())
      .post(`/api/stations/media/${mediaId}/upload`)
      .set(stationAuth(captureToken))
      .expect(201);
    expect(resumed.body.uploadedBytes).toBe(400);

    await request(app.getHttpServer())
      .patch(`/api/stations/media/${mediaId}/upload`)
      .set(stationAuth(captureToken))
      .send({ uploadedBytes: 300 })
      .expect(409);

    mockHead.mockRejectedValueOnce(new Error('Blob not found'));
    await request(app.getHttpServer())
      .post(`/api/stations/media/${mediaId}/finalize`)
      .set(stationAuth(captureToken))
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/stations/media/${mediaId}/upload`)
      .set(stationAuth(captureToken))
      .send({ uploadedBytes: 1000 })
      .expect(200);

    mockHead.mockResolvedValue({
      url: 'https://example.public.blob.vercel-storage.com/test-video.mp4',
      downloadUrl: 'https://example.public.blob.vercel-storage.com/test-video.mp4?download=1',
      pathname: `organizations/${organizationAId}/events/${eventAId}/media/${mediaId}.mp4`,
      size: 1000,
      uploadedAt: new Date('2026-08-12T18:31:00.000Z'),
      contentType: 'video/mp4',
      contentDisposition: 'inline',
      cacheControl: 'public, max-age=31536000',
      etag: 'test-etag',
    });

    const finalized = await request(app.getHttpServer())
      .post(`/api/stations/media/${mediaId}/finalize`)
      .set(stationAuth(captureToken))
      .expect(201);
    expect(finalized.body.media.syncState).toBe('SYNCED');
    expect(finalized.body.upload.state).toBe('COMPLETED');

    const finalizeReplay = await request(app.getHttpServer())
      .post(`/api/stations/media/${mediaId}/finalize`)
      .set(stationAuth(captureToken))
      .expect(201);
    expect(finalizeReplay.body.media.id).toBe(mediaId);

    const afterSync = await request(app.getHttpServer())
      .get('/api/stations/media')
      .set(stationAuth(sharingToken))
      .expect(200);
    expect(afterSync.body).toHaveLength(1);
    expect(afterSync.body[0].id).toBe(mediaId);
  });
});