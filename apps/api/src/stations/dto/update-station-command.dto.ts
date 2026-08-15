import { RemoteCaptureCommand, VisualEffect } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateStationCommandDto {
  @IsOptional()
  @IsEnum(RemoteCaptureCommand)
  command?: RemoteCaptureCommand;

  @IsOptional()
  @IsEnum(VisualEffect)
  selectedEffect?: VisualEffect;
}
