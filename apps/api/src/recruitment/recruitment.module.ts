import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AgentContractExportService } from './agent-contract-export.service';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';

@Module({
  imports:[AuthModule],
  controllers:[RecruitmentController],
  providers:[RecruitmentService,AgentContractExportService],
  exports:[RecruitmentService],
})
export class RecruitmentModule {}
