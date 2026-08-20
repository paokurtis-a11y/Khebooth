import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { EnterpriseOnboardingService } from './enterprise-onboarding.service';

@Controller('enterprise/onboarding')
export class EnterpriseOnboardingController{
  constructor(private readonly enterprise:EnterpriseOnboardingService){}

  @Get('system/purge-expired-documents')
  purge(@Headers('authorization') authorization?:string){const secret=authorization?.startsWith('Bearer ')?authorization.slice(7):undefined;return this.enterprise.purgeExpiredDocuments(secret);}

  @Get(':token') form(@Param('token') token:string){return this.enterprise.publicForm(token);}
  @Patch(':token') save(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.enterprise.savePublicForm(token,body);}
  @Post(':token/documents/upload') upload(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.enterprise.prepareDocumentUpload(token,body);}
  @Post(':token/documents/confirm') confirm(@Param('token') token:string,@Body() body:Record<string,unknown>){return this.enterprise.confirmDocument(token,body);}
}
