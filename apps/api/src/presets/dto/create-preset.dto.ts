import { AspectRatio } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePresetDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsEnum(AspectRatio)
  aspectRatio!: AspectRatio;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}
