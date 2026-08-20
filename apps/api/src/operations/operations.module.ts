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

@Module({imports:[PrismaModule],controllers:[OperationsController,PublicAnalyticsController,SupportFeedbackController,RoutingIntelligenceController,WorkforceIntelligenceController],providers:[OperationsService,RoutingIntelligenceService,WorkforceIntelligenceService],exports:[OperationsService,RoutingIntelligenceService,WorkforceIntelligenceService]})
export class OperationsModule{}
