import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailMarketingController } from './email-marketing.controller';
import { EmailMarketingService } from './email-marketing.service';
import { GrowthIntelligenceService } from './growth-intelligence.service';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { PublicMarketingService } from './public-marketing.service';
import { ReportExportService } from './report-export.service';

@Module({
  imports:[AuthModule],
  controllers:[MarketingController,EmailMarketingController],
  providers:[MarketingService,PublicMarketingService,ReportExportService,GrowthIntelligenceService,EmailMarketingService],
  exports:[MarketingService,PublicMarketingService,ReportExportService,GrowthIntelligenceService,EmailMarketingService],
})
export class MarketingModule {}