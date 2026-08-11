import { StationMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class RedeemStationDto {
  @IsUUID()
  eventId!: string;

  @IsString()
  @Matches(/^KHE-\d{6}$/)
  code!: string;

  @IsString()
  @MaxLength(160)
  installationId!: string;

  @IsEnum(StationMode)
  mode!: StationMode;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  deviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  platform?: string;
}
