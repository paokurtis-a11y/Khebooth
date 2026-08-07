import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { EventsModule } from './events/events.module';
import { PresetsModule } from './presets/presets.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, ClientsModule, EventsModule, PresetsModule],
})
export class AppModule {}
