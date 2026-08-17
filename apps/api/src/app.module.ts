import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { CommerceModule } from './commerce/commerce.module';
import { EventsModule } from './events/events.module';
import { HealthModule } from './health/health.module';
import { MobileModule } from './mobile/mobile.module';
import { PresetsModule } from './presets/presets.module';
import { PrismaModule } from './prisma/prisma.module';
import { StationsModule } from './stations/stations.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, ClientsModule, EventsModule, PresetsModule, CommerceModule, StationsModule, MobileModule, SupportModule],
})
export class AppModule {}
