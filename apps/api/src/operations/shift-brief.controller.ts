import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ShiftBriefService } from './shift-brief.service';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('operations/workforce/brief')
export class ShiftBriefController{
  constructor(private readonly brief:ShiftBriefService){}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Get('compact') compact(@CurrentUser() user:AuthenticatedUser){return this.brief.compact(user);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Get('me') mine(@CurrentUser() user:AuthenticatedUser){return this.brief.mine(user);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post('refresh') refreshCurrent(@CurrentUser() user:AuthenticatedUser){return this.brief.refreshCurrent(user);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Patch('items/:id/note') updateNote(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.brief.updateNote(user,id,body);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('team') team(@CurrentUser() user:AuthenticatedUser){return this.brief.team(user);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('policy') policy(@CurrentUser() user:AuthenticatedUser){return this.brief.policy(user.organizationId);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch('policy') updatePolicy(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.brief.updatePolicy(user.organizationId,body);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Post('briefs/:id/refresh') refreshBrief(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.brief.refreshBrief(user,id);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post('pulse') pulse(@CurrentUser() user:AuthenticatedUser){return this.brief.pulse(user);}
}
