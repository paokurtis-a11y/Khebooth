import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.client.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(organizationId: string, id: string) {
    const client = await this.prisma.client.findFirst({ where: { id, organizationId } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(organizationId: string, userId: string, dto: CreateClientDto) {
    const client = await this.prisma.client.create({ data: { ...dto, organizationId } });
    await this.audit(organizationId, userId, 'CLIENT_CREATED', client.id);
    return client;
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateClientDto) {
    await this.get(organizationId, id);
    const client = await this.prisma.client.update({ where: { id }, data: dto });
    await this.audit(organizationId, userId, 'CLIENT_UPDATED', id);
    return client;
  }

  async remove(organizationId: string, userId: string, id: string) {
    await this.get(organizationId, id);
    await this.prisma.client.delete({ where: { id } });
    await this.audit(organizationId, userId, 'CLIENT_DELETED', id);
    return { deleted: true };
  }

  private audit(organizationId: string, userId: string, action: string, entityId: string) {
    return this.prisma.auditLog.create({
      data: { organizationId, userId, action, entityType: 'Client', entityId },
    });
  }
}
