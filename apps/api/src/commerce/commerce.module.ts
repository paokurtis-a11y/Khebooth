import { Module } from '@nestjs/common';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { SiteContentService } from './site-content.service';

@Module({
  controllers:[CommerceController],
  providers:[CommerceService,SiteContentService],
  exports:[CommerceService],
})
export class CommerceModule {}
