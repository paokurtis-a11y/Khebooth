import { Module } from '@nestjs/common';
import { MarketingModule } from '../marketing/marketing.module';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { CustomerAccessService } from './customer-access.service';
import { PromotionCheckoutService } from './promotion-checkout.service';
import { SiteContentService } from './site-content.service';

@Module({
  imports:[MarketingModule],
  controllers:[CommerceController],
  providers:[CommerceService,CustomerAccessService,PromotionCheckoutService,SiteContentService],
  exports:[CommerceService],
})
export class CommerceModule {}
