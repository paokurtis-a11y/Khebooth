import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClientEnterpriseAccessService } from './client-enterprise-access.service';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { EnterpriseOnboardingService } from './enterprise-onboarding.service';

@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly enterprise:ClientEnterpriseAccessService,
    private readonly onboarding:EnterpriseOnboardingService,
  ) {}

  @Permissions('clients.view') @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.clients.list(user.organizationId); }

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('enterprise/forms/templates')
  enterpriseTemplates(@CurrentUser() user:AuthenticatedUser){return this.onboarding.templates(user.organizationId,user.role);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER) @Patch('enterprise/forms/templates/:templateId')
  updateEnterpriseTemplate(@CurrentUser() user:AuthenticatedUser,@Param('templateId',new ParseUUIDPipe()) templateId:string,@Body() body:Record<string,unknown>){return this.onboarding.updateTemplate(user.organizationId,user.id,user.role,templateId,body);}

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('enterprise/offers/catalog')
  enterpriseOffers(@CurrentUser() user:AuthenticatedUser){return this.onboarding.offers(user.organizationId,user.role);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER) @Patch('enterprise/offers/catalog/:offerId')
  updateEnterpriseOffer(@CurrentUser() user:AuthenticatedUser,@Param('offerId',new ParseUUIDPipe()) offerId:string,@Body() body:Record<string,unknown>){return this.onboarding.updateOffer(user.organizationId,user.role,offerId,body);}

  @Permissions('clients.view') @Get(':id') get(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.clients.get(user.organizationId, id); }

  @Permissions('clients.manage') @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR) @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientDto) { return this.clients.create(user.organizationId, user.id, dto); }

  @Permissions('clients.manage') @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR) @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser,@Param('id', new ParseUUIDPipe()) id: string,@Body() dto: UpdateClientDto) { return this.clients.update(user.organizationId, user.id, id, dto); }

  @Permissions('clients.delete') @Roles(UserRole.OWNER, UserRole.ADMIN) @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.clients.remove(user.organizationId, user.id, id); }

  @Permissions('clients.manage') @Roles(UserRole.OWNER) @Post(':id/enterprise-access')
  enterpriseAccess(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.enterprise.setAccess(user.organizationId,user.id,user.role,id,body.enabled===true);}

  @Permissions('clients.view') @Roles(UserRole.OWNER) @Get(':id/enterprise-access-report')
  enterpriseAccessReport(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.enterprise.report(user.organizationId,user.role,id);}

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get(':id/enterprise-onboarding')
  enterpriseOnboarding(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.onboarding.adminReport(user.organizationId,user.role,id);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER,UserRole.ADMIN) @Post(':id/enterprise-onboarding/invite')
  enterpriseInvite(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.onboarding.invite(user.organizationId,user.id,user.role,id);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch(':id/enterprise-onboarding/review')
  enterpriseReview(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.onboarding.reviewOnboarding(user.organizationId,user.id,user.role,id,body);}

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get(':id/profile-avatar')
  clientProfileAvatar(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.onboarding.profileAvatarTicket(user.organizationId,user.role,id);}

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get(':id/enterprise-documents/:documentId')
  enterpriseDocument(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Param('documentId',new ParseUUIDPipe()) documentId:string){return this.onboarding.documentTicket(user.organizationId,user.role,id,documentId);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch(':id/enterprise-documents/:documentId')
  reviewEnterpriseDocument(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Param('documentId',new ParseUUIDPipe()) documentId:string,@Body() body:Record<string,unknown>){return this.onboarding.reviewDocument(user.organizationId,user.id,user.role,id,documentId,body);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER,UserRole.ADMIN) @Post(':id/enterprise-quotes')
  enterpriseQuote(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.onboarding.createQuote(user.organizationId,user.id,user.role,id,body);}
}
