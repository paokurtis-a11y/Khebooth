import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EnterpriseContractService } from './enterprise-contract.service';
import { EnterpriseReverificationService } from './enterprise-reverification.service';

@UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
@Controller('clients')
export class EnterpriseAdminController{
  constructor(private readonly reverification:EnterpriseReverificationService,private readonly contracts:EnterpriseContractService){}

  @Permissions('enterprise.verify') @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Get('enterprise/reverification/queue')
  queue(@CurrentUser() user:AuthenticatedUser){return this.reverification.queue(user.organizationId);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER) @Post(':id/enterprise-reverification/start')
  manualReverification(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.reverification.manualStart(user.organizationId,user.id,user.role,id);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER) @Post(':id/enterprise-contracts/generate')
  generateContract(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.contracts.ensureForClient(user.organizationId,id);}
}
