import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AgentWorkforceService } from './agent-workforce.service';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('operations/workforce/agent')
export class AgentWorkforceController{
  constructor(private readonly workforce:AgentWorkforceService){}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Get('compact') compact(@CurrentUser() user:AuthenticatedUser){return this.workforce.compact(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Get('me') mine(@CurrentUser() user:AuthenticatedUser){return this.workforce.mine(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Post('notices/:id/read') markNoticeRead(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.workforce.markNoticeRead(user,id);}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Post('shifts/:id/respond') respond(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.workforce.respond(user,id,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Post('availability') addAvailability(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.workforce.addAvailability(user,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Patch('availability/:id/cancel') cancelAvailability(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.workforce.cancelAvailability(user,id);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('team') team(@CurrentUser() user:AuthenticatedUser){return this.workforce.team(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('shifts/:id/replacements') replacements(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.workforce.replacements(user,id);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('shifts/:id/reassign') reassign(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.workforce.reassign(user,id,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Post('pulse') pulse(@CurrentUser() user:AuthenticatedUser){return this.workforce.pulse(user);}
}
