import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { StationJwtStrategy } from './station-jwt.strategy';
import { StationController } from './station.controller';
import { StationService } from './station.service';

@Module({
  imports: [PassportModule, AuthModule, EventsModule],
  controllers: [StationController],
  providers: [StationService, StationJwtStrategy],
})
export class StationModule {}
