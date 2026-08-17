import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  private present<T extends { name: string; email: string | null }>(client: T) {
    const [firstName = '', ...lastParts] = client.name.trim().split(/\s+/);
    return { ...client, firstName, lastName: lastParts.join(' ') || firstName };
  }

  async list(organizationId: string) {
    const clients = await this.prisma.client.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
    return clients.map((client) => this.present(client));
  }

  async get(organizationId: string, id: string) {
    const client = await this.prisma.client.findFirst({ where: { id, organizationId } });
    if (!client) throw new NotFoundException('Client not found');
    return this.present(client);
  }

  async create(organizationId: string, userId: string, dto: CreateClientDto) {
    const firstName = dto.firstName.trim();
    const lastName = dto.name.trim();
    const email = dto.email.trim().toLowerCase();
    if (!firstName || !lastName || !email) throw new BadRequestException('First name, last name and email are required');
    const client = await this.prisma.client.create({
      data: {
        organizationId,
        name: `${firstName} ${lastName}`,
        email,
        phone: dto.phone?.trim() || null,
        companyName: dto.companyName?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });
    await this.audit(organizationId, userId, 'CLIENT_CREATED', client.id);
    return this.present(client);
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateClientDto) {
    const current = await this.get(organizationId, id);
    const firstName = (dto.firstName ?? current.firstName).trim();
    const lastName = (dto.name ?? current.lastName).trim();
    const email = (dto.email ?? current.email ?? '').trim().toLowerCase();
    if (!firstName || !lastName || !email) throw new BadRequestException('First name, last name and email are required');
    const client = await this.prisma.client.update({
      where: { id },
      data: {
        name: `${firstName} ${lastName}`,
        email,
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
        ...(dto.companyName !== undefined ? { companyName: dto.companyName.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      },
    });
    await this.audit(organizationId, userId, 'CLIENT_UPDATED', id);
    return this.present(client);
  }

  async remove(organizationId: string, userId: string, id: string) {
    await this.get(organizationId, id);
    await this.prisma.client.delete({ where: { id } });
    await this.audit(organizationId, userId, 'CLIENT_DELETED', id);
    return { deleted: true };
  }

  private audit(organizationId: string, userId: string, action: string, entityId: string) {
    return this.prisma.auditLog.create({ data: { organizationId, userId, action, entityType: 'Client', entityId } });
  }
}
