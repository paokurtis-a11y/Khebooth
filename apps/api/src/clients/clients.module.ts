import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientEnterpriseAccessService } from './client-enterprise-access.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { EnterpriseCommercialService } from './enterprise-commercial.service';
import { EnterpriseContractExportService } from './enterprise-contract-export.service';
import { EnterpriseContractService } from './enterprise-contract.service';
import { EnterpriseFormExportService } from './enterprise-form-export.service';
import { EnterpriseOnboardingController } from './enterprise-onboarding.controller';
import { EnterpriseOnboardingService } from './enterprise-onboarding.service';
import { EnterpriseQuoteCheckoutService } from './enterprise-quote-checkout.service';
import { EnterpriseVerificationService } from './enterprise-verification.service';

@Module({
  imports:[AuthModule],
  controllers:[ClientsController,EnterpriseOnboardingController],
  providers:[ClientsService,ClientEnterpriseAccessService,EnterpriseOnboardingService,EnterpriseFormExportService,EnterpriseQuoteCheckoutService,EnterpriseContractService,EnterpriseContractExportService,EnterpriseCommercialService,EnterpriseVerificationService],
  exports:[EnterpriseOnboardingService,EnterpriseContractService,EnterpriseCommercialService,EnterpriseVerificationService],
})
export class ClientsModule {}
