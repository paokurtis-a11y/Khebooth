import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePresetDto } from './dto/create-preset.dto';
import { UpdatePresetDto } from './dto/update-preset.dto';

@Injectable()
export class PresetsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.preset.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
  }

  async get(organizationId: string, id: string) {
    const preset = await this.prisma.preset.findFirst({ where: { id, organizationId } });
    if (!preset) throw new NotFoundException('Preset not found');
    return preset;
  }

  async create(organizationId: string, userId: string, dto: CreatePresetDto) {
    const preset = await this.prisma.preset.create({
      data: {
        organizationId,
        name: dto.name,
        aspectRatio: dto.aspectRatio,
        configuration: dto.configuration ?? {},
      },
    });
    await this.audit(organizationId, userId, 'PRESET_CREATED', preset.id);
    return preset;
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdatePresetDto) {
    await this.get(organizationId, id);
    const preset = await this.prisma.preset.update({ where: { id }, data: dto });
    await this.audit(organizationId, userId, 'PRESET_UPDATED', id);
    return preset;
  }

  async remove(organizationId: string, userId: string, id: string) {
    await this.get(organizationId, id);
    await this.prisma.preset.delete({ where: { id } });
    await this.audit(organizationId, userId, 'PRESET_DELETED', id);
    return { deleted: true };
  }

  private audit(organizationId: string, userId: string, action: string, entityId: string) {
    return this.prisma.auditLog.create({
      data: { organizationId, userId, action, entityType: 'Preset', entityId },
    });
  }
}
