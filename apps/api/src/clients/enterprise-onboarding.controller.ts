import { Body, Controller, Get, Headers, Param, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { EnterpriseFormExportService } from './enterprise-form-export.service';
import { EnterpriseOnboardingService } from './enterprise-onboarding.service';

@Controller('enterprise/onboarding')
export class EnterpriseOnboardingController{
  constructor(private readonly enterprise:EnterpriseOnboardingService,private readonly exports:EnterpriseFormExportService){}

  @Get('system/purge-expired-documents')
  purge(@Headers('authorization') authorization?:string){const secret=authorization?.startsWith('Bearer ')?authorization.slice(7):undefined;return this.enterprise.purgeExpiredDocuments(secret);}

  @Get(':token/export/:format')
  async exportForm(@Param('token') token:string,@Param('format') format:string,@Res() response:Response){const file=await this.exports.generate(token,format);response.setHeader('Content-Type',file.contentType);response.setHeader('Content-Disposition',`attachment; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g,'-')}"`);response.setHeader('Cache-Control','private, no-store');response.send(file.buffer);}

  @Get(':token') form(@Param('token') token:string){return this.enterprise.publicForm(token);}
  @Patch(':token') save(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.enterprise.savePublicForm(token,body);}
  @Post(':token/documents/upload') upload(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.enterprise.prepareDocumentUpload(token,body);}
  @Post(':token/documents/confirm') confirm(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.enterprise.confirmDocument(token,body);}
}
