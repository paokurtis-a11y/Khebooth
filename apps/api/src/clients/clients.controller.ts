import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Permissions('clients.view')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.clients.list(user.organizationId); }

  @Permissions('clients.view')
  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.clients.get(user.organizationId, id); }

  @Permissions('clients.manage')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientDto) { return this.clients.create(user.organizationId, user.id, dto); }

  @Permissions('clients.manage')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser,@Param('id', new ParseUUIDPipe()) id: string,@Body() dto: UpdateClientDto) { return this.clients.update(user.organizationId, user.id, id, dto); }

  @Permissions('clients.delete')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.clients.remove(user.organizationId, user.id, id); }
}
