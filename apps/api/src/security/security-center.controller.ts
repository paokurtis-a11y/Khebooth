import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SecurityCenterService } from './security-center.service';

@UseGuards(AuthGuard('jwt'))
@Controller('security-center')
export class SecurityCenterController{
  constructor(private readonly security:SecurityCenterService){}

  @Get('status') status(@CurrentUser() user:AuthenticatedUser){return this.security.status(user.organizationId);}
  @Get('overview') overview(@CurrentUser() user:AuthenticatedUser){return this.security.overview(user.organizationId,user.role);}
  @Patch('config') config(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.security.updateConfig(user.organizationId,user.role,body);}
  @Patch('incidents/:id') incident(@CurrentUser() user:AuthenticatedUser,@Param('id') id:string,@Body() body:Record<string,unknown>){return this.security.updateIncident(user.organizationId,user.role,id,body);}
}
