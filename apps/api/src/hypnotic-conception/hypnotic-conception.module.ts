import { Module } from '@nestjs/common';
import { SecurityCenterModule } from '../security/security-center.module';
import { HypnoticConceptionController } from './hypnotic-conception.controller';
import { HypnoticConceptionService } from './hypnotic-conception.service';

@Module({
  imports: [SecurityCenterModule],
  controllers: [HypnoticConceptionController],
  providers: [HypnoticConceptionService],
})
export class HypnoticConceptionModule {}
