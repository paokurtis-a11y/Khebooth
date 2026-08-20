import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { PublicAnalyticsController } from './public-analytics.controller';
import { RoutingIntelligenceController } from './routing-intelligence.controller';
import { RoutingIntelligenceService } from './routing-intelligence.service';
import { SupportFeedbackController } from './support-feedback.controller';
import { WorkforceIntelligenceController } from './workforce-intelligence.controller';
import { WorkforceIntelligenceService } from './workforce-intelligence.service';
import { WorkforceScheduleOptimizerController } from './workforce-schedule-optimizer.controller';
import { WorkforceScheduleOptimizerService } from './workforce-schedule-optimizer.service';

@Module({imports:[PrismaModule],controllers:[OperationsController,PublicAnalyticsController,SupportFeedbackController,RoutingIntelligenceController,WorkforceIntelligenceController,WorkforceScheduleOptimizerController],providers:[OperationsService,RoutingIntelligenceService,WorkforceIntelligenceService,WorkforceScheduleOptimizerService],exports:[OperationsService,RoutingIntelligenceService,WorkforceIntelligenceService,WorkforceScheduleOptimizerService]})
export class OperationsModule{}
