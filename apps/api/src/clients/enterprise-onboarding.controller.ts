import { Body, Controller, Get, Headers, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { EnterpriseContractExportService } from './enterprise-contract-export.service';
import { EnterpriseContractService } from './enterprise-contract.service';
import { EnterpriseFormExportService } from './enterprise-form-export.service';
import { EnterpriseOnboardingService } from './enterprise-onboarding.service';
import { EnterpriseReverificationService } from './enterprise-reverification.service';
import { EnterpriseVerificationService } from './enterprise-verification.service';

@Controller('enterprise/onboarding')
export class EnterpriseOnboardingController{
  constructor(
    private readonly enterprise:EnterpriseOnboardingService,
    private readonly exports:EnterpriseFormExportService,
    private readonly contracts:EnterpriseContractService,
    private readonly contractExports:EnterpriseContractExportService,
    private readonly verification:EnterpriseVerificationService,
    private readonly reverification:EnterpriseReverificationService,
  ){}

  @Get('system/purge-expired-documents')
  purge(@Headers('authorization') authorization?:string){const secret=authorization?.startsWith('Bearer ')?authorization.slice(7):undefined;return this.enterprise.purgeExpiredDocuments(secret);}

  @Get('system/review-sla')
  reviewSla(@Headers('authorization') authorization?:string){const secret=authorization?.startsWith('Bearer ')?authorization.slice(7):undefined;return this.verification.processSla(secret);}

  @Get('system/reverification')
  annualReverification(@Headers('authorization') authorization?:string){const secret=authorization?.startsWith('Bearer ')?authorization.slice(7):undefined;return this.reverification.process(secret);}

  @Get(':token/export/:format')
  async exportForm(@Param('token') token:string,@Param('format') format:string,@Res() response:Response){const file=await this.exports.generate(token,format);response.setHeader('Content-Type',file.contentType);response.setHeader('Content-Disposition',`attachment; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g,'-')}"`);response.setHeader('Cache-Control','private, no-store');response.send(file.buffer);}

  @Get(':token/contract/export/:format')
  async exportContract(@Param('token') token:string,@Param('format') format:string,@Res() response:Response){const file=await this.contractExports.publicExport(token,format);response.setHeader('Content-Type',file.contentType);response.setHeader('Content-Disposition',`attachment; filename="${file.filename.replace(/[^a-zA-Z0-9._-]/g,'-')}"`);response.setHeader('Cache-Control','private, no-store');response.send(file.buffer);}

  @Get(':token/reverification-status') reverificationStatus(@Param('token') token:string){return this.reverification.publicStatus(token);}
  @Get(':token/status') status(@Param('token') token:string){return this.verification.publicStatus(token);}
  @Get(':token/contract') contract(@Param('token') token:string){return this.contracts.publicContract(token);}
  @Patch(':token/language') language(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.contracts.setPreferredLanguage(token,String(body.language??''));}
  @Post(':token/contract/sign') sign(@Param('token') token:string,@Body() body:Record<string,unknown>,@Req() request:Request){return this.contracts.signNative(token,body,{ipAddress:request.ip,userAgent:request.headers['user-agent']??null});}
  @Post(':token/contract/manual-upload') manualUpload(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.contracts.prepareManualSignedUpload(token,body);}
  @Post(':token/contract/manual-confirm') manualConfirm(@Param('token') token:string,@Body() body:Record<string,unknown>,@Req() request:Request){return this.contracts.confirmManualSignedUpload(token,body,{ipAddress:request.ip,userAgent:request.headers['user-agent']??null});}

  @Get(':token') form(@Param('token') token:string){return this.enterprise.publicForm(token);}
  @Patch(':token') async save(@Param('token') token:string,@Body() body:Record<string,unknown>){const saved=await this.enterprise.savePublicForm(token,body);if(body.submit===true){const contract=await this.contracts.publicContract(token);return{...saved,contractReady:true,contract:{id:contract.contract.id,contractNumber:contract.contract.contractNumber,status:contract.contract.status,language:contract.contract.language,termMonths:contract.contract.termMonths}};}return{...saved,contractReady:false};}
  @Post(':token/documents/upload') upload(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.enterprise.prepareDocumentUpload(token,body);}
  @Post(':token/documents/confirm') confirm(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.enterprise.confirmDocument(token,body);}
}
