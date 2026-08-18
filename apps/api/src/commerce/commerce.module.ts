import { Module } from '@nestjs/common';
import { MarketingModule } from '../marketing/marketing.module';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { CustomerAccessService } from './customer-access.service';
import { LocalizedSiteService } from './localized-site.service';
import { MarketPricingService } from './market-pricing.service';
import { PaymentAnalyticsService } from './payment-analytics.service';
import { PromotionCheckoutService } from './promotion-checkout.service';
import { SiteContentService } from './site-content.service';

@Module({
  imports:[MarketingModule],
  controllers:[CommerceController],
  providers:[CommerceService,CustomerAccessService,LocalizedSiteService,MarketPricingService,PaymentAnalyticsService,PromotionCheckoutService,SiteContentService],
  exports:[CommerceService,MarketPricingService],
})
export class CommerceModule {}
