import { Body, Controller, Get, Headers, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EmailMarketingService } from './email-marketing.service';

@Controller('marketing/email')
export class EmailMarketingController{
  constructor(private readonly emailMarketing:EmailMarketingService){}

  @Get('public/unsubscribe')
  unsubscribe(@Query('client') clientId='',@Query('token') token=''){return this.emailMarketing.unsubscribe(clientId,token);}

  @Get('system/process')
  process(@Headers('authorization') authorization?:string){const secret=authorization?.startsWith('Bearer ')?authorization.slice(7):undefined;return this.emailMarketing.process(secret);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('marketing.view')
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Get('summary')
  summary(@CurrentUser() user:AuthenticatedUser){return this.emailMarketing.summary(user.organizationId);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('marketing.view')
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Get('settings')
  settings(@CurrentUser() user:AuthenticatedUser){return this.emailMarketing.settings(user.organizationId);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('marketing.manage')
  @Roles(UserRole.OWNER)
  @Patch('settings')
  updateSettings(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.emailMarketing.updateSettings(user.organizationId,user.id,body);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('marketing.view')
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Get('scenarios')
  scenarios(@CurrentUser() user:AuthenticatedUser){return this.emailMarketing.scenarios(user.organizationId);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('marketing.manage')
  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Patch('scenarios/:code')
  updateScenario(@CurrentUser() user:AuthenticatedUser,@Param('code') code:string,@Body() body:Record<string,unknown>){return this.emailMarketing.updateScenario(user.organizationId,user.id,code,body);}
}
