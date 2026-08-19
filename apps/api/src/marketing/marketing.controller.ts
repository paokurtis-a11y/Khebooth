import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MarketingService } from './marketing.service';
import { PublicMarketingService } from './public-marketing.service';
import { ReportExportService } from './report-export.service';

@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketing:MarketingService,private readonly publicMarketing:PublicMarketingService,private readonly reports:ReportExportService) {}
  @Post('public/track') track(@Body() body:Record<string,unknown>){return this.marketing.trackPublic(body);}
  @Get('public/promotion') promotion(){return this.publicMarketing.promotion();}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('marketing.view')
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Get('dashboard') dashboard(@CurrentUser() user:AuthenticatedUser,@Query('days') days='30'){return this.marketing.dashboard(user.organizationId,Number(days));}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('marketing.manage')
  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Patch('automation') updateAutomation(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.marketing.updateAutomation(user.organizationId,body);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('marketing.manage')
  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('automation/evaluate') evaluate(@CurrentUser() user:AuthenticatedUser){return this.marketing.evaluateAutomation(user.organizationId);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('marketing.manage')
  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Post('campaigns') createCampaign(@CurrentUser() user:AuthenticatedUser,@Body() body:Record<string,unknown>){return this.marketing.createCampaign(user.organizationId,body,false);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('marketing.manage')
  @Roles(UserRole.OWNER,UserRole.ADMIN)
  @Patch('campaigns/:id') updateCampaign(@CurrentUser() user:AuthenticatedUser,@Param('id') id:string,@Body() body:Record<string,unknown>){return this.marketing.updateCampaign(user.organizationId,id,body);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('reports.export')
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Get('report.pdf')
  async pdf(@CurrentUser() user:AuthenticatedUser,@Query('days') days='30',@Res() response:Response){const file=await this.marketing.reportPdf(user.organizationId,Number(days));response.setHeader('Content-Type','application/pdf');response.setHeader('Content-Disposition',`attachment; filename="khe-marketing-${new Date().toISOString().slice(0,10)}.pdf"`);response.send(file);}

  @UseGuards(AuthGuard('jwt'),RolesGuard,PermissionsGuard)
  @Permissions('reports.export')
  @Roles(UserRole.OWNER,UserRole.ADMIN,UserRole.OPERATOR)
  @Get('report/:format')
  async exportReport(@CurrentUser() user:AuthenticatedUser,@Param('format') format:string,@Query('days') days='30',@Res() response:Response){
    const file=await this.reports.generate(user.organizationId,format,Number(days));
    response.setHeader('Content-Type',file.contentType);
    response.setHeader('Content-Disposition',`attachment; filename="${file.filename}"`);
    response.setHeader('Cache-Control','private, no-store');
    response.send(file.buffer);
  }
}