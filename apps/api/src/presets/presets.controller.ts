import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePresetDto } from './dto/create-preset.dto';
import { UpdatePresetDto } from './dto/update-preset.dto';
import { PresetsService } from './presets.service';

@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('presets')
export class PresetsController {
  constructor(private readonly presets: PresetsService) {}

  @Permissions('studio.view')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.presets.list(user.organizationId); }

  @Permissions('studio.view')
  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.presets.get(user.organizationId, id); }

  @Permissions('studio.manage')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePresetDto) { return this.presets.create(user.organizationId, user.id, dto); }

  @Permissions('studio.manage')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser,@Param('id', new ParseUUIDPipe()) id: string,@Body() dto: UpdatePresetDto) { return this.presets.update(user.organizationId, user.id, id, dto); }

  @Permissions('studio.delete')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.presets.remove(user.organizationId, user.id, id); }
}
