import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentWorkforceController } from './agent-workforce.controller';
import { AgentWorkforceService } from './agent-workforce.service';
import { LiveShiftController } from './live-shift.controller';
import { LiveShiftService } from './live-shift.service';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { PublicAnalyticsController } from './public-analytics.controller';
import { RoutingIntelligenceController } from './routing-intelligence.controller';
import { RoutingIntelligenceService } from './routing-intelligence.service';
import { ShiftBriefController } from './shift-brief.controller';
import { ShiftBriefService } from './shift-brief.service';
import { ShiftHandoverController } from './shift-handover.controller';
import { ShiftHandoverService } from './shift-handover.service';
import { SlaRescueController } from './sla-rescue.controller';
import { SlaRescueService } from './sla-rescue.service';
import { SupportFeedbackController } from './support-feedback.controller';
import { WorkforceIntelligenceController } from './workforce-intelligence.controller';
import { WorkforceIntelligenceService } from './workforce-intelligence.service';
import { WorkforceScheduleOptimizerController } from './workforce-schedule-optimizer.controller';
import { WorkforceScheduleOptimizerService } from './workforce-schedule-optimizer.service';

@Module({imports:[PrismaModule],controllers:[OperationsController,PublicAnalyticsController,SupportFeedbackController,RoutingIntelligenceController,WorkforceIntelligenceController,WorkforceScheduleOptimizerController,AgentWorkforceController,LiveShiftController,ShiftHandoverController,ShiftBriefController,SlaRescueController],providers:[OperationsService,RoutingIntelligenceService,WorkforceIntelligenceService,WorkforceScheduleOptimizerService,AgentWorkforceService,ShiftHandoverService,ShiftBriefService,SlaRescueService,LiveShiftService],exports:[OperationsService,RoutingIntelligenceService,WorkforceIntelligenceService,WorkforceScheduleOptimizerService,AgentWorkforceService,ShiftHandoverService,ShiftBriefService,SlaRescueService,LiveShiftService]})
export class OperationsModule{}
