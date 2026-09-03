import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { CommerceModule } from './commerce/commerce.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { HypnoticConceptionModule } from './hypnotic-conception/hypnotic-conception.module';
import { MarketingModule } from './marketing/marketing.module';
import { MobileModule } from './mobile/mobile.module';
import { OperationsModule } from './operations/operations.module';
import { PresetsModule } from './presets/presets.module';
import { PrismaModule } from './prisma/prisma.module';
import { SecurityCenterModule } from './security/security-center.module';
import { StationsModule } from './stations/stations.module';
import { SupportModule } from './support/support.module';
import { TeamModule } from './team/team.module';

@Module({
  imports:[PrismaModule,HealthModule,AuthModule,ClientsModule,EventsModule,PresetsModule,MarketingModule,CommerceModule,StationsModule,MobileModule,SupportModule,TeamModule,OperationsModule,SecurityCenterModule,HypnoticConceptionModule],
})
export class AppModule {}
