import { Body, Controller, Get, Headers, Param, Patch, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CommerceService } from './commerce.service';
import { SiteContentService } from './site-content.service';

@Controller('commerce')
export class CommerceController {
  constructor(private readonly commerce: CommerceService, private readonly siteContent: SiteContentService) {}
  @Get('public/site') publicSite(){return this.commerce.publicSiteConfig();}
  @Post('public/checkout') checkout(@Body() body:Record<string,unknown>){return this.commerce.checkout(body);}
  @Post('webhooks/stripe') stripeWebhook(@Req() request:RawBodyRequest<Request>,@Headers('stripe-signature') signature?:string){if(!request.rawBody)throw new Error('Raw request body is unavailable');this.commerce.verifyStripeSignature(request.rawBody,signature);return this.commerce.handleStripeEvent(JSON.parse(request.rawBody.toString('utf8')));}
  @UseGuards(AuthGuard('jwt'),RolesGuard) @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('admin/site') adminSite(@CurrentUser() user:AuthenticatedUser){return this.commerce.adminSiteConfig(user.organizationId);}
  @UseGuards(AuthGuard('jwt'),RolesGuard) @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch('admin/site') updateSite(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.commerce.updateSiteConfig(user.organizationId,body);}
  @UseGuards(AuthGuard('jwt'),RolesGuard) @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch('admin/site-content') updateSiteContent(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.siteContent.update(user.organizationId,body);}
  @UseGuards(AuthGuard('jwt'),RolesGuard) @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch('admin/plans/:code') updatePlan(@CurrentUser() user:AuthenticatedUser,@Param('code') code:string,@Body() body:Record<string,unknown>){return this.commerce.updatePlan(user.organizationId,code.toUpperCase(),body);}
  @UseGuards(AuthGuard('jwt'),RolesGuard) @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post('admin/clients/:id/messages') manualMessage(@CurrentUser() user:AuthenticatedUser,@Param('id') clientId:string,@Body() body:Record<string,unknown>){return this.commerce.manualMessage(user.organizationId,clientId,body);}
}
