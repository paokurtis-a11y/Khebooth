import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SlaRescueService } from './sla-rescue.service';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('operations/workforce/rescue')
export class SlaRescueController{
  constructor(private readonly rescue:SlaRescueService){}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Get('compact') compact(@CurrentUser() user:AuthenticatedUser){return this.rescue.compact(user);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Get('me') mine(@CurrentUser() user:AuthenticatedUser){return this.rescue.mine(user);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('team') team(@CurrentUser() user:AuthenticatedUser){return this.rescue.team(user);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('policy') policy(@CurrentUser() user:AuthenticatedUser){return this.rescue.policy(user.organizationId);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch('policy') updatePolicy(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.rescue.updatePolicy(user.organizationId,body);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('cases/:id/candidates') candidates(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.rescue.candidates(user,id);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Post('cases/:id/hold') hold(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.rescue.hold(user,id,body);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Post('cases/:id/prepare-relay') prepareRelay(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.rescue.prepareRelay(user,id,body);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Post('cases/:id/apply-relay') applyRelay(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.rescue.applyRelay(user,id);}
  @Roles(UserRole.OWNER,UserRole.ADMIN) @Post('cases/:id/escalate') escalate(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.rescue.escalate(user,id,body);}
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post('pulse') pulse(@CurrentUser() user:AuthenticatedUser){return this.rescue.pulse(user);}
}
