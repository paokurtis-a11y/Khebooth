import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';

const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = integrationEnabled ? describe : describe.skip;
const foreignClientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

suite('Organization isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let organizationAId: string;
  let organizationBId: string;
  let userAId: string;
  let userAEmail: string;

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
    jwt = app.get(JwtService);

    const organizationA = await prisma.organization.create({ data: { name: 'Organization A' } });
    const organizationB = await prisma.organization.create({ data: { name: 'Organization B' } });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;
    userAEmail = `owner-a-${organizationA.id}@example.test`;

    const userA = await prisma.user.create({
      data: {
        organizationId: organizationA.id,
        email: userAEmail,
        passwordHash: 'not-used-by-this-isolation-test',
        role: UserRole.OWNER,
      },
    });
    userAId = userA.id;

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
    const accessToken = await jwt.signAsync({
      sub: userAId,
      organizationId: organizationAId,
      email: userAEmail,
      role: UserRole.OWNER,
    });

    const response = await request(app.getHttpServer())
      .get(`/clients/${foreignClientId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    if (response.status !== 404) {
      throw new Error(`Cross-org request returned ${response.status}: ${JSON.stringify(response.body)}`);
    }

    expect(response.body).toMatchObject({ statusCode: 404 });
  });
});
