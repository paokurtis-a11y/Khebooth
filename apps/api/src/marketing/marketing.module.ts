import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { PublicMarketingService } from './public-marketing.service';

@Module({
  controllers:[MarketingController],
  providers:[MarketingService,PublicMarketingService],
  exports:[MarketingService,PublicMarketingService],
})
export class MarketingModule {}
