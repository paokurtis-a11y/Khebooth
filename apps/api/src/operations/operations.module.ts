import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { PublicAnalyticsController } from './public-analytics.controller';
import { SupportFeedbackController } from './support-feedback.controller';

@Module({imports:[PrismaModule],controllers:[OperationsController,PublicAnalyticsController,SupportFeedbackController],providers:[OperationsService],exports:[OperationsService]})
export class OperationsModule{}
