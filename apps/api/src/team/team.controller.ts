import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TeamService } from './team.service';

@Controller('team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Permissions('team.manage') @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.team.list(user); }

  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Permissions('team.manage') @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Post('invitations') invite(@CurrentUser() user: AuthenticatedUser, @Body() body: Record<string, unknown>) { return this.team.invite(user, body); }

  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Permissions('team.manage') @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Delete('invitations/:id') revokeInvitation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.team.revokeInvitation(user, id); }

  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Permissions('team.manage') @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Patch('members/:id') updateMember(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: Record<string, unknown>) { return this.team.updateMember(user, id, body); }

  @Get('invitations/:token') invitation(@Param('token') token: string) { return this.team.invitation(token); }
  @Post('invitations/:token/accept') accept(@Param('token') token: string, @Body() body: Record<string, unknown>) { return this.team.accept(token, body); }
}
