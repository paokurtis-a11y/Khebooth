import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientEnterpriseAccessService } from './client-enterprise-access.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { EnterpriseContractExportService } from './enterprise-contract-export.service';
import { EnterpriseContractService } from './enterprise-contract.service';
import { EnterpriseFormExportService } from './enterprise-form-export.service';
import { EnterpriseOnboardingController } from './enterprise-onboarding.controller';
import { EnterpriseOnboardingService } from './enterprise-onboarding.service';
import { EnterpriseQuoteCheckoutService } from './enterprise-quote-checkout.service';

@Module({
  imports:[AuthModule],
  controllers:[ClientsController,EnterpriseOnboardingController],
  providers:[ClientsService,ClientEnterpriseAccessService,EnterpriseOnboardingService,EnterpriseFormExportService,EnterpriseQuoteCheckoutService,EnterpriseContractService,EnterpriseContractExportService],
  exports:[EnterpriseOnboardingService,EnterpriseContractService],
})
export class ClientsModule {}
