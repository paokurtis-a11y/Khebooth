import { Body, Controller, Get, Headers, Param, Patch, Post, Query, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CommerceService } from './commerce.service';
import { CustomerAccessService } from './customer-access.service';
import { LocalizedSiteService } from './localized-site.service';
import { PaymentAnalyticsService } from './payment-analytics.service';
import { PromotionCheckoutService } from './promotion-checkout.service';
import { SiteContentService } from './site-content.service';

@Controller('commerce')
export class CommerceController {
  constructor(private readonly commerce:CommerceService,private readonly checkoutService:PromotionCheckoutService,private readonly customerAccess:CustomerAccessService,private readonly localizedSite:LocalizedSiteService,private readonly paymentAnalytics:PaymentAnalyticsService,private readonly siteContent:SiteContentService) {}
  @Get('public/site') publicSite(@Headers('x-vercel-ip-country') detectedCountry?:string,@Query('country') requestedCountry?:string,@Query('currency') currency?:string){return this.localizedSite.publicSite(requestedCountry||detectedCountry,currency);}
  @Get('public/reviews') publicReviews(){return this.customerAccess.publicReviews();}
  @Post('public/checkout') checkout(@Body() body:Record<string,unknown>,@Headers('x-vercel-ip-country') country?:string){return this.checkoutService.checkout(body,country);}
  @Post('public/account') account(@Body() body:Record<string,unknown>){return this.customerAccess.account(body);}
  @Post('public/billing-portal') billingPortal(@Body() body:Record<string,unknown>){return this.customerAccess.portal(body);}
  @Post('public/reviews') submitReview(@Body() body:Record<string,unknown>){return this.customerAccess.submitReview(body);}

  @Post('webhooks/stripe')
  async stripeWebhook(@Req() request:RawBodyRequest<Request>,@Headers('stripe-signature') signature?:string){if(!request.rawBody)throw new Error('Raw request body is unavailable');this.commerce.verifyStripeSignature(request.rawBody,signature);const event=JSON.parse(request.rawBody.toString('utf8')) as any;const result=await this.commerce.handleStripeEvent(event);const object=event?.data?.object??{};const clientId=object?.metadata?.clientId??null;const planCode=object?.metadata?.planCode??null;if(event?.type==='checkout.session.completed'&&object?.payment_status==='paid'&&clientId){await this.paymentAnalytics.completed(String(clientId),planCode?String(planCode):null,Number(object?.amount_total??object?.metadata?.amountCents??0),{provider:'stripe',campaignId:object?.metadata?.campaignId??null,currency:object?.currency??object?.metadata?.currency??null});}return result;}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard) @Permissions('site.manage') @Roles(UserRole.OWNER,UserRole.ADMIN) @Get('admin/site') adminSite(@CurrentUser() user:AuthenticatedUser){return this.commerce.adminSiteConfig(user.organizationId);}
  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard) @Permissions('site.manage') @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch('admin/site') updateSite(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.commerce.updateSiteConfig(user.organizationId,body);}
  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard) @Permissions('site.manage') @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch('admin/site-content') updateSiteContent(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.siteContent.update(user.organizationId,body);}
  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard) @Permissions('site.manage') @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch('admin/plans/:code') updatePlan(@CurrentUser() user:AuthenticatedUser,@Param('code') code:string,@Body() body:Record<string,unknown>){return this.commerce.updatePlan(user.organizationId,code.toUpperCase(),body);}
  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard) @Permissions('site.manage') @Roles(UserRole.OWNER,UserRole.ADMIN) @Patch('admin/plans/:code/localized-prices') updateLocalizedPrices(@CurrentUser() user:AuthenticatedUser,@Param('code') code:string,@Body() body:Record<string,unknown>){return this.localizedSite.updateLocalizedPrices(user.organizationId,code.toUpperCase(),body);}
  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard) @Permissions('communications.manage') @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR) @Post('admin/clients/:id/messages') manualMessage(@CurrentUser() user:AuthenticatedUser,@Param('id') clientId:string,@Body() body:Record<string,unknown>){return this.commerce.manualMessage(user.organizationId,clientId,body);}
}
