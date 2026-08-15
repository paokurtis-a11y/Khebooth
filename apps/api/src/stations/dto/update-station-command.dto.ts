import { RemoteCaptureCommand, VisualEffect } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

const CAPTURE_DURATIONS = [10, 15, 20, 25, 30] as const;

export class UpdateStationCommandDto {
  @IsOptional()
  @IsEnum(RemoteCaptureCommand)
  command?: RemoteCaptureCommand;

  @IsOptional()
  @IsEnum(VisualEffect)
  selectedEffect?: VisualEffect;

  @IsOptional()
  @IsIn(CAPTURE_DURATIONS)
  maxDurationSeconds?: 10 | 15 | 20 | 25 | 30;
}
