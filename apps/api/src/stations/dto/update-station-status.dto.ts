import { RemoteCaptureState } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

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
}
