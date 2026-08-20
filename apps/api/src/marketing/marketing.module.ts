import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GrowthIntelligenceService } from './growth-intelligence.service';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { PublicMarketingService } from './public-marketing.service';
import { ReportExportService } from './report-export.service';

@Module({
  imports:[AuthModule],
  controllers:[MarketingController],
  providers:[MarketingService,PublicMarketingService,ReportExportService,GrowthIntelligenceService],
  exports:[MarketingService,PublicMarketingService,ReportExportService,GrowthIntelligenceService],
})
export class MarketingModule {}