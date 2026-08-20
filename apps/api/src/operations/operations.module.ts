import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { PublicAnalyticsController } from './public-analytics.controller';
import { RoutingIntelligenceController } from './routing-intelligence.controller';
import { RoutingIntelligenceService } from './routing-intelligence.service';
import { SupportFeedbackController } from './support-feedback.controller';

@Module({imports:[PrismaModule],controllers:[OperationsController,PublicAnalyticsController,SupportFeedbackController,RoutingIntelligenceController],providers:[OperationsService,RoutingIntelligenceService],exports:[OperationsService,RoutingIntelligenceService]})
export class OperationsModule{}
