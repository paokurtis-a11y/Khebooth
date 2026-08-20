import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RoutingIntelligenceService } from './routing-intelligence.service';

@UseGuards(AuthGuard('jwt'),RolesGuard)
@Controller('operations/routing')
export class RoutingIntelligenceController{
  constructor(private readonly routing:RoutingIntelligenceService){}

  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Post('pulse') pulse(@CurrentUser() user:AuthenticatedUser){return this.routing.pulse(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('dashboard') dashboard(@CurrentUser() user:AuthenticatedUser){return this.routing.dashboard(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('profiles') profiles(@CurrentUser() user:AuthenticatedUser){return this.routing.profiles(user);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Patch('profiles/:id') updateProfile(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.routing.updateProfile(user,id,body);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Get('policy') policy(@CurrentUser() user:AuthenticatedUser){return this.routing.policy(user.organizationId);}

  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Patch('policy') updatePolicy(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.routing.updatePolicy(user.organizationId,body);}
}
