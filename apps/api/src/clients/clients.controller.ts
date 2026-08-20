import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
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
import { EnterpriseCommercialService } from './enterprise-commercial.service';
import { EnterpriseContractExportService } from './enterprise-contract-export.service';
import { EnterpriseContractService } from './enterprise-contract.service';
import { EnterpriseOnboardingService } from './enterprise-onboarding.service';
import { EnterpriseQuoteCheckoutService } from './enterprise-quote-checkout.service';
import { EnterpriseVerificationService } from './enterprise-verification.service';

@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly enterprise:ClientEnterpriseAccessService,
    private readonly onboarding:EnterpriseOnboardingService,
    private readonly commercial:EnterpriseCommercialService,
    private readonly contracts:EnterpriseContractService,
    private readonly contractExports:EnterpriseContractExportService,
    private readonly verification:EnterpriseVerificationService,
    private readonly enterpriseQuoteCheckout:EnterpriseQuoteCheckoutService,
  ) {}

  @Permissions('clients.view') @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.clients.list(user.organizationId); }

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('enterprise/forms/templates')
  enterpriseTemplates(@CurrentUser() user:AuthenticatedUser){return this.onboarding.templates(user.organizationId,user.role);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER) @Patch('enterprise/forms/templates/:templateId')
  updateEnterpriseTemplate(@CurrentUser() user:AuthenticatedUser,@Param('templateId',new ParseUUIDPipe()) templateId:string,@Body() body:Record<string,unknown>){return this.onboarding.updateTemplate(user.organizationId,user.id,user.role,templateId,body);}

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('enterprise/offers/catalog')
  enterpriseOffers(@CurrentUser() user:AuthenticatedUser){return this.commercial.offers(user.organizationId,user.role);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER) @Patch('enterprise/offers/catalog/:offerId')
  updateEnterpriseOffer(@CurrentUser() user:AuthenticatedUser,@Param('offerId',new ParseUUIDPipe()) offerId:string,@Body() body:Record<string,unknown>){return this.commercial.updateOffer(user.organizationId,user.role,offerId,body);}

  @Permissions('clients.view') @Roles(UserRole.OWNER) @Get('enterprise/contracts/templates')
  enterpriseContractTemplates(@CurrentUser() user:AuthenticatedUser){return this.contracts.templates(user.organizationId,user.role);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER) @Patch('enterprise/contracts/templates/:templateId')
  updateEnterpriseContractTemplate(@CurrentUser() user:AuthenticatedUser,@Param('templateId',new ParseUUIDPipe()) templateId:string,@Body() body:Record<string,unknown>){return this.contracts.updateTemplate(user.organizationId,user.id,user.role,templateId,body);}

  @Permissions('enterprise.verify') @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Get('enterprise/verification/queue')
  enterpriseVerificationQueue(@CurrentUser() user:AuthenticatedUser){return this.verification.queue(user.organizationId);}

  @Permissions('clients.view') @Roles(UserRole.OWNER) @Get('enterprise/workflow/settings')
  enterpriseWorkflowSettings(@CurrentUser() user:AuthenticatedUser){return this.verification.settings(user.organizationId);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER) @Patch('enterprise/workflow/settings')
  updateEnterpriseWorkflowSettings(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.verification.updateSettings(user.organizationId,user.id,body);}

  @Permissions('clients.view') @Get(':id') get(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.clients.get(user.organizationId, id); }

  @Permissions('clients.manage') @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR) @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientDto) { return this.clients.create(user.organizationId, user.id, dto); }

  @Permissions('clients.manage') @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.OPERATOR) @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser,@Param('id', new ParseUUIDPipe()) id: string,@Body() dto: UpdateClientDto) { return this.clients.update(user.organizationId, user.id, id, dto); }

  @Permissions('clients.delete') @Roles(UserRole.OWNER, UserRole.ADMIN) @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) { return this.clients.remove(user.organizationId, user.id, id); }

  @Permissions('clients.manage') @Roles(UserRole.OWNER) @Post(':id/enterprise-access')
  enterpriseAccess(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.enterprise.setAccess(user.organizationId,user.id,user.role,id,body.enabled===true,String(body.password??''));}

  @Permissions('clients.view') @Roles(UserRole.OWNER) @Get(':id/enterprise-access-report')
  enterpriseAccessReport(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.enterprise.report(user.organizationId,user.role,id);}

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Get(':id/enterprise-journey')
  enterpriseJourney(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.commercial.journey(user.organizationId,user.role,id);}

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get(':id/enterprise-onboarding')
  enterpriseOnboarding(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.onboarding.adminReport(user.organizationId,user.role,id);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER,UserRole.ADMIN) @Post(':id/enterprise-onboarding/invite')
  enterpriseInvite(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.onboarding.invite(user.organizationId,user.id,user.role,id);}

  @Permissions('enterprise.verify') @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch(':id/enterprise-onboarding/review')
  enterpriseReview(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.onboarding.reviewOnboarding(user.organizationId,user.id,user.role,id,body);}

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get(':id/profile-avatar')
  clientProfileAvatar(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.onboarding.profileAvatarTicket(user.organizationId,user.role,id);}

  @Permissions('enterprise.verify') @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Get(':id/enterprise-documents/:documentId')
  enterpriseDocument(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Param('documentId',new ParseUUIDPipe()) documentId:string){return this.verification.documentTicket(user.organizationId,id,documentId);}

  @Permissions('enterprise.verify') @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Patch(':id/enterprise-documents/:documentId')
  reviewEnterpriseDocument(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Param('documentId',new ParseUUIDPipe()) documentId:string,@Body() body:Record<string,unknown>){return this.verification.reviewDocument(user.organizationId,user.id,id,documentId,body);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post(':id/enterprise-quotes')
  enterpriseQuote(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:Record<string,unknown>){return this.commercial.createQuote(user.organizationId,user.id,user.role,id,body);}

  @Permissions('clients.manage') @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post(':id/enterprise-quotes/:quoteId/send')
  sendEnterpriseQuote(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Param('quoteId',new ParseUUIDPipe()) quoteId:string){return this.enterpriseQuoteCheckout.send(user.organizationId,user.id,user.role,id,quoteId);}

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get(':id/enterprise-contracts')
  enterpriseContracts(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string){return this.contracts.adminContracts(user.organizationId,user.role,id);}

  @Permissions('clients.view') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get(':id/enterprise-contracts/:contractId/export/:format')
  async exportEnterpriseContract(@CurrentUser() user:AuthenticatedUser,@Param('id',new ParseUUIDPipe()) id:string,@Param('contractId',new ParseUUIDPipe()) contractId:string,@Param('format') format:string,@Res() response:Response){const file=await this.contractExports.adminExport(user.organizationId,user.role,id,contractId,format);response.setHeader('Content-Type',file.contentType);response.setHeader('Content-Disposition',`attachment; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g,'-')}"`);response.setHeader('Cache-Control','private, no-store');response.send(file.buffer);}
}
