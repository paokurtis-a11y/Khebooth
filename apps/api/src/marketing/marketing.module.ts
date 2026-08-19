import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { PublicMarketingService } from './public-marketing.service';
import { ReportExportService } from './report-export.service';

@Module({
  imports:[AuthModule],
  controllers:[MarketingController],
  providers:[MarketingService,PublicMarketingService,ReportExportService],
  exports:[MarketingService,PublicMarketingService,ReportExportService],
})
export class MarketingModule {}