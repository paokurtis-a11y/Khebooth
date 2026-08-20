import { NotFoundException } from '@nestjs/common';
import { ClientsService } from '../src/clients/clients.service';
import { PrismaService } from '../src/prisma/prisma.service';

const integrationEnabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = integrationEnabled ? describe : describe.skip;

suite('Organization isolation (PostgreSQL integration)', () => {
  let prisma: PrismaService;
  let clients: ClientsService;
  let organizationAId: string;
  let organizationBId: string;
  let clientBId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
    prisma = new PrismaService();
    await prisma.$connect();
    clients = new ClientsService(prisma, { ensureInvitationForClient: async () => undefined } as any);

    const organizationA = await prisma.organization.create({ data: { name: 'Organization A' } });
    const organizationB = await prisma.organization.create({ data: { name: 'Organization B' } });
    organizationAId = organizationA.id;
    organizationBId = organizationB.id;

    const clientB = await prisma.client.create({
      data: {
        organizationId: organizationB.id,
        name: 'Private client B',
      },
    });
    clientBId = clientB.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId] } } });
    await prisma.client.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [organizationAId, organizationBId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationAId, organizationBId] } } });
    await prisma.$disconnect();
  });

  it('does not expose Organization B client to Organization A', async () => {
    await expect(clients.get(organizationAId, clientBId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does expose the client to its owning organization', async () => {
    const client = await clients.get(organizationBId, clientBId);
    expect(client.id).toBe(clientBId);
    expect(client.organizationId).toBe(organizationBId);
  });
});
