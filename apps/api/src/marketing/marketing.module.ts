import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { PublicMarketingService } from './public-marketing.service';

@Module({
  imports:[AuthModule],
  controllers:[MarketingController],
  providers:[MarketingService,PublicMarketingService],
  exports:[MarketingService,PublicMarketingService],
})
export class MarketingModule {}
