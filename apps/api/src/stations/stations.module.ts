import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { StationAuthGuard } from './station-auth.guard';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [StationsController],
  providers: [StationsService, StationAuthGuard],
})
export class StationsModule {}
