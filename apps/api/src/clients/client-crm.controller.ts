import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClientCrmService } from './client-crm.service';

@UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
@Controller('clients/crm')
export class ClientCrmController{
  constructor(private readonly crm:ClientCrmService){}

  @Permissions('clients.view')
  @Get()
  list(@CurrentUser() user:AuthenticatedUser,@Query('archived') archived='false',@Query('search') search=''){return this.crm.list(user.organizationId,archived==='true',search);}

  @Permissions('clients.view')
  @Get(':id')
  get(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.crm.get(user.organizationId,id);}

  @Permissions('clients.view')
  @Get(':id/emails')
  emails(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.crm.history(user.organizationId,id);}

  @Permissions('clients.manage')
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Post(':id/archive')
  archive(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.crm.archive(user.organizationId,user.id,id);}

  @Permissions('clients.manage')
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Post(':id/restore')
  restore(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.crm.restore(user.organizationId,user.id,id);}
}
