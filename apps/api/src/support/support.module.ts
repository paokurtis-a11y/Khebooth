import { Module } from '@nestjs/common';
import { KheSupportContextService } from './khe-support-context.service';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  controllers: [SupportController],
  providers: [SupportService, KheSupportContextService],
})
export class SupportModule {}
