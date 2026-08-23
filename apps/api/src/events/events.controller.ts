import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventReadinessService } from './event-readiness.service';
import { EventsService } from './events.service';

@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly readiness: EventReadinessService,
  ) {}

  @Permissions('events.view')
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.events.list(user.organizationId); }

  @Permissions('events.view')
  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.events.get(user.organizationId, id); }

  @Permissions('events.view')
  @Get(':id/readiness')
  eventReadiness(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.readiness.snapshot(user.organizationId, id);
  }

  @Permissions('events.manage')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) { return this.events.create(user.organizationId, user.id, dto); }

  @Permissions('events.manage')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser,@Param('id', new ParseUUIDPipe()) id: string,@Body() dto: UpdateEventDto) { return this.events.update(user.organizationId, user.id, id, dto); }

  @Permissions('events.delete')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.events.remove(user.organizationId, user.id, id); }

  @Permissions('events.manage')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR)
  @Post(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.events.activate(user.organizationId, user.id, id); }

  @Permissions('events.view')
  @Get(':id/manifest')
  manifest(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.events.manifest(user.organizationId, id); }
}
