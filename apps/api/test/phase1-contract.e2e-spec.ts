import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AspectRatio, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = integrationEnabled ? describe : describe.skip;

suite('Phase 1 API contract (PostgreSQL integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationAId: string;
  let organizationBId: string;
  let ownerToken: string;
  let adminToken: string;
  let operatorToken: string;
  let shareHostToken: string;
  let ownerBToken: string;

  const password = 'Phase1-Test-Password!2026';
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    const organizationA = await prisma.organization.create({ data: { name: `Phase1 A ${suffix}` } });
    const organizationB = await prisma.organization.create({ data: { name: `Phase1 B ${suffix}` } });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const passwordHash = await argon2.hash(password);
    await prisma.user.createMany({
      data: [
        { organizationId: organizationAId, email: `owner-a-${suffix}@example.com`, passwordHash, role: UserRole.OWNER },
        { organizationId: organizationAId, email: `admin-a-${suffix}@example.com`, passwordHash, role: UserRole.ADMIN },
        { organizationId: organizationAId, email: `operator-a-${suffix}@example.com`, passwordHash, role: UserRole.OPERATOR },
        { organizationId: organizationAId, email: `share-a-${suffix}@example.com`, passwordHash, role: UserRole.SHARE_HOST },
        { organizationId: organizationBId, email: `owner-b-${suffix}@example.com`, passwordHash, role: UserRole.OWNER },
      ],
    });

    ownerToken = await login(`owner-a-${suffix}@example.com`);
    adminToken = await login(`admin-a-${suffix}@example.com`);
    operatorToken = await login(`operator-a-${suffix}@example.com`);
    shareHostToken = await login(`share-a-${suffix}@example.com`);
    ownerBToken = await login(`owner-b-${suffix}@example.com`);
  });

  afterAll(async () => {
    if (prisma && organizationAId && organizationBId) {
      const organizationIds = [organizationAId, organizationBId];
      await prisma.eventActivation.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.event.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.client.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.preset.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    }
    if (app) await app.close();
  });

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    expect(response.body.accessToken).toEqual(expect.any(String));
    return response.body.accessToken as string;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('enforces all four RBAC roles on reads, writes and deletes', async () => {
    await request(app.getHttpServer()).get('/api/clients').set(auth(shareHostToken)).expect(200);
    await request(app.getHttpServer())
      .post('/api/clients')
      .set(auth(shareHostToken))
      .send({ name: 'Forbidden share-host client' })
      .expect(403);

    const operatorCreated = await request(app.getHttpServer())
      .post('/api/clients')
      .set(auth(operatorToken))
      .send({ firstName: 'Operator', name: 'Client', email: `operator-client-${suffix}@example.com` })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/clients/${operatorCreated.body.id}`)
      .set(auth(operatorToken))
      .send({ name: 'Client updated' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/clients/${operatorCreated.body.id}`)
      .set(auth(operatorToken))
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/clients/${operatorCreated.body.id}`)
      .set(auth(adminToken))
      .expect(200);

    const ownerCreated = await request(app.getHttpServer())
      .post('/api/clients')
      .set(auth(ownerToken))
      .send({ firstName: 'Owner', name: 'Delete client', email: `owner-delete-${suffix}@example.com` })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/clients/${ownerCreated.body.id}`)
      .set(auth(ownerToken))
      .expect(200);
  });

  it('isolates clients, presets, events and manifests by organizationId', async () => {
    const clientB = await request(app.getHttpServer())
      .post('/api/clients')
      .set(auth(ownerBToken))
      .send({ firstName: 'Private', name: 'Client B', email: `private-client-b-${suffix}@example.com` })
      .expect(201);
    const presetB = await request(app.getHttpServer())
      .post('/api/presets')
      .set(auth(ownerBToken))
      .send({ name: 'Private preset B', aspectRatio: AspectRatio.SQUARE_1_1, configuration: {} })
      .expect(201);
    const eventB = await request(app.getHttpServer())
      .post('/api/events')
      .set(auth(ownerBToken))
      .send({
        name: 'Private event B',
        startsAt: '2026-08-12T18:00:00.000Z',
        clientId: clientB.body.id,
        presetId: presetB.body.id,
      })
      .expect(201);

    await request(app.getHttpServer()).get(`/api/clients/${clientB.body.id}`).set(auth(ownerToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/presets/${presetB.body.id}`).set(auth(ownerToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/events/${eventB.body.id}`).set(auth(ownerToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/events/${eventB.body.id}/manifest`).set(auth(ownerToken)).expect(404);

    await request(app.getHttpServer())
      .post('/api/events')
      .set(auth(ownerToken))
      .send({ name: 'Invalid cross-org event', startsAt: '2026-08-12T19:00:00.000Z', clientId: clientB.body.id })
      .expect(400);
  });

  it('validates full CRUD, activation revocation, audit and manifest contract', async () => {
    const client = await request(app.getHttpServer())
      .post('/api/clients')
      .set(auth(operatorToken))
      .send({ firstName: 'Phase', name: '1 client', email: `phase1-client-${suffix}@example.com`, companyName: 'KHE test' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/clients/${client.body.id}`)
      .set(auth(operatorToken))
      .send({ notes: 'Updated through Phase 1 integration test' })
      .expect(200);

    const preset = await request(app.getHttpServer())
      .post('/api/presets')
      .set(auth(operatorToken))
      .send({
        name: 'Phase 1 portrait',
        aspectRatio: AspectRatio.PORTRAIT_9_16,
        configuration: { countdownSeconds: 3 },
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/presets/${preset.body.id}`)
      .set(auth(operatorToken))
      .send({ configuration: { countdownSeconds: 5 } })
      .expect(200);

    const event = await request(app.getHttpServer())
      .post('/api/events')
      .set(auth(operatorToken))
      .send({
        name: 'Phase 1 event',
        description: 'Contract validation',
        startsAt: '2026-08-12T20:00:00.000Z',
        endsAt: '2026-08-12T23:00:00.000Z',
        clientId: client.body.id,
        presetId: preset.body.id,
        venueName: 'KHE Test Venue',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/events/${event.body.id}`)
      .set(auth(operatorToken))
      .send({ venueAddress: 'Phase 1 test address' })
      .expect(200);

    const firstActivation = await request(app.getHttpServer())
      .post(`/api/events/${event.body.id}/activate`)
      .set(auth(operatorToken))
      .expect(201);
    const secondActivation = await request(app.getHttpServer())
      .post(`/api/events/${event.body.id}/activate`)
      .set(auth(operatorToken))
      .expect(201);
    expect(firstActivation.body.code).toMatch(/^KHE-\d{6}$/);
    expect(secondActivation.body.code).toMatch(/^KHE-\d{6}$/);

    const activations = await prisma.eventActivation.findMany({
      where: { organizationId: organizationAId, eventId: event.body.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(activations).toHaveLength(2);
    expect(activations[0].revokedAt).toBeInstanceOf(Date);
    expect(activations[1].revokedAt).toBeNull();
    expect(activations[0].codeHash).not.toBe(firstActivation.body.code);
    expect(activations[1].codeHash).not.toBe(secondActivation.body.code);

    const manifest = await request(app.getHttpServer())
      .get(`/api/events/${event.body.id}/manifest`)
      .set(auth(shareHostToken))
      .expect(200);
    expect(manifest.body.version).toBe(1);
    expect(manifest.body.generatedAt).toEqual(expect.any(String));
    expect(manifest.body.organization).toEqual(expect.objectContaining({ id: organizationAId }));
    expect(manifest.body.event).toEqual(expect.objectContaining({ id: event.body.id, name: 'Phase 1 event' }));
    expect(manifest.body.client).toEqual(expect.objectContaining({ id: client.body.id, name: 'Phase 1 client' }));
    expect(manifest.body.preset).toEqual(expect.objectContaining({ id: preset.body.id, aspectRatio: AspectRatio.PORTRAIT_9_16 }));
    expect(manifest.body.capabilities).toEqual({
      capture: true,
      sharing: true,
      separateStations: true,
      formats: ['9:16', '1:1'],
    });
    expect(manifest.body.mediaPolicy).toEqual({
      offlineFirst: true,
      preserveUnsyncedMedia: true,
      idempotentUploads: true,
      resumableUploads: true,
      export: { container: 'MP4', videoCodec: 'H.264', audioCodec: 'AAC' },
    });
    expect(JSON.stringify(manifest.body)).not.toContain(firstActivation.body.code);
    expect(JSON.stringify(manifest.body)).not.toContain(secondActivation.body.code);

    const actions = await prisma.auditLog.findMany({
      where: { organizationId: organizationAId, entityId: { in: [client.body.id, preset.body.id, event.body.id] } },
      select: { action: true },
    });
    const actionNames = actions.map((entry) => entry.action);
    expect(actionNames).toEqual(expect.arrayContaining([
      'CLIENT_CREATED',
      'CLIENT_UPDATED',
      'PRESET_CREATED',
      'PRESET_UPDATED',
      'EVENT_CREATED',
      'EVENT_UPDATED',
      'EVENT_ACTIVATED',
    ]));

    await request(app.getHttpServer()).delete(`/api/events/${event.body.id}`).set(auth(adminToken)).expect(200);
    await request(app.getHttpServer()).delete(`/api/presets/${preset.body.id}`).set(auth(ownerToken)).expect(200);
    await request(app.getHttpServer()).delete(`/api/clients/${client.body.id}`).set(auth(adminToken)).expect(200);
    await request(app.getHttpServer()).get(`/api/events/${event.body.id}`).set(auth(ownerToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/presets/${preset.body.id}`).set(auth(ownerToken)).expect(404);
    await request(app.getHttpServer()).get(`/api/clients/${client.body.id}`).set(auth(ownerToken)).expect(404);
  });
});
