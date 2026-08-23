import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { EventReadinessService } from './event-readiness.service';
import { EventsAutomationController } from './events-automation.controller';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [AuthModule,SubscriptionsModule],
  controllers: [EventsController, EventsAutomationController],
  providers: [EventsService, EventReadinessService],
  exports: [EventsService, EventReadinessService],
})
export class EventsModule {}
