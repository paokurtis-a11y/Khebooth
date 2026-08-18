import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PresetsController } from './presets.controller';
import { PresetsService } from './presets.service';

@Module({
  imports:[AuthModule],
  controllers: [PresetsController],
  providers: [PresetsService],
})
export class PresetsModule {}
