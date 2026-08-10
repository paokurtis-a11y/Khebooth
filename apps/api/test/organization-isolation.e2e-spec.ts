import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';

const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = integrationEnabled ? describe : describe.skip;
const foreignClientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

suite('Organization isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationAId: string;
  let organizationBId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
    process.env.JWT_SECRET = 'integration-test-secret-change-outside-tests';
    process.env.JWT_EXPIRES_IN_SECONDS = '3600';

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const organizationA = await prisma.organization.create({ data: { name: 'Organization A' } });
    const organizationB = await prisma.organization.create({ data: { name: 'Organization B' } });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    await prisma.user.create({
      data: {
        organizationId: organizationA.id,
        email: `owner-a-${organizationA.id}@example.test`,
        passwordHash: await argon2.hash('correct-password'),
        role: UserRole.OWNER,
      },
    });

    await prisma.client.create({
      data: {
        id: foreignClientId,
        organizationId: organizationB.id,
        name: 'Private client B',
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId] } } });
      await prisma.client.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId] } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [organizationAId, organizationBId] } } });
    }
    if (app) await app.close();
  });

  it('returns 404 when Organization A requests a client owned by Organization B', async () => {
    const email = `owner-a-${organizationAId}@example.test`;
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'correct-password' });

    if (login.status !== 201) {
      throw new Error(`Login failed with ${login.status}: ${JSON.stringify(login.body)}`);
    }

    const response = await request(app.getHttpServer())
      .get(`/clients/${foreignClientId}`)
      .set('Authorization', `Bearer ${login.body.accessToken as string}`);

    if (response.status !== 404) {
      throw new Error(`Cross-org request returned ${response.status}: ${JSON.stringify(response.body)}`);
    }

    expect(response.body).toMatchObject({ statusCode: 404 });
  });
});
