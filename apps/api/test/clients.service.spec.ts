import { NotFoundException } from '@nestjs/common';
import { ClientsService } from '../src/clients/clients.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ClientsService organization isolation', () => {
  const organizationA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const organizationB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const clientId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  const prisma = {
    client: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  } as unknown as PrismaService;

  const service = new ClientsService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('always scopes client lookup by authenticated organizationId', async () => {
    jest.spyOn(prisma.client, 'findFirst').mockResolvedValue(null);

    await expect(service.get(organizationA, clientId)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: clientId, organizationId: organizationA },
    });
    expect(prisma.client.findFirst).not.toHaveBeenCalledWith({
      where: { id: clientId, organizationId: organizationB },
    });
  });

  it('does not update a client when it is not visible to the authenticated organization', async () => {
    jest.spyOn(prisma.client, 'findFirst').mockResolvedValue(null);

    await expect(
      service.update(organizationA, 'dddddddd-dddd-dddd-dddd-dddddddddddd', clientId, { name: 'Blocked update' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.client.update).not.toHaveBeenCalled();
  });
});
