import { RemoteCaptureState } from '@prisma/client';
import { IsEnum, IsIn, IsInt, IsOptional, Min } from 'class-validator';

const CAPTURE_DURATIONS = [10, 15, 20, 25, 30] as const;

export class UpdateStationStatusDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  acknowledgedVersion?: number;

  @IsOptional()
  @IsEnum(RemoteCaptureState)
  runtimeState?: RemoteCaptureState;

  @IsOptional()
  @IsInt()
  @Min(0)
  elapsedSeconds?: number;

  @IsOptional()
  @IsIn(CAPTURE_DURATIONS)
  maxDurationSeconds?: 10 | 15 | 20 | 25 | 30;
}
