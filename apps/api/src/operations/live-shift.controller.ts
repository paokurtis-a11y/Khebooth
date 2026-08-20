import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LiveShiftService } from './live-shift.service';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('operations/workforce/live')
export class LiveShiftController{
  constructor(private readonly live:LiveShiftService){}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Get('compact') compact(@CurrentUser() user:AuthenticatedUser){return this.live.compact(user);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Get('me') mine(@CurrentUser() user:AuthenticatedUser){return this.live.mine(user);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post('shifts/:id/start') start(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.live.start(user,id);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post('shifts/:id/pause') pause(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.live.pause(user,id);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post('shifts/:id/resume') resume(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.live.resume(user,id);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post('shifts/:id/end') end(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.live.end(user,id);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('team') team(@CurrentUser() user:AuthenticatedUser){return this.live.team(user);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('policy') policy(@CurrentUser() user:AuthenticatedUser){return this.live.policy(user.organizationId);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch('policy') updatePolicy(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.live.updatePolicy(user.organizationId,body);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Post('alerts/:id/acknowledge') acknowledge(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.live.acknowledge(user,id);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post('pulse') pulse(@CurrentUser() user:AuthenticatedUser){return this.live.pulse(user);}
}
