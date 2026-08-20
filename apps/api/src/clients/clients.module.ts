import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientEnterpriseAccessService } from './client-enterprise-access.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { EnterpriseOnboardingController } from './enterprise-onboarding.controller';
import { EnterpriseOnboardingService } from './enterprise-onboarding.service';

@Module({
  imports:[AuthModule],
  controllers:[ClientsController,EnterpriseOnboardingController],
  providers:[ClientsService,ClientEnterpriseAccessService,EnterpriseOnboardingService],
  exports:[EnterpriseOnboardingService],
})
export class ClientsModule {}
