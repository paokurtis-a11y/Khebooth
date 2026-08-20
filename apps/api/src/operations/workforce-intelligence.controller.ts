import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { WorkforceIntelligenceService } from './workforce-intelligence.service';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('operations/workforce')
export class WorkforceIntelligenceController{
  constructor(private readonly workforce:WorkforceIntelligenceService){}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('dashboard') dashboard(@CurrentUser() user:AuthenticatedUser,@Query('days') days?:string){const parsed=Math.trunc(Number(days));return this.workforce.dashboard(user,Number.isFinite(parsed)?parsed:undefined);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('config') config(@CurrentUser() user:AuthenticatedUser){return this.workforce.config(user.organizationId);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Patch('config') updateConfig(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.workforce.updateConfig(user.organizationId,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('shifts') createShift(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.workforce.createShift(user,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Patch('shifts/:id') updateShift(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.workforce.updateShift(user,id,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('alerts/:id/acknowledge') acknowledge(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.workforce.acknowledgeAlert(user,id);}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Post('pulse') pulse(@CurrentUser() user:AuthenticatedUser){return this.workforce.pulse(user);}
}
