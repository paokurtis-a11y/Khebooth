import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateMediaDto {
  @IsString()
  @MaxLength(200)
  localId!: string;

  @IsString()
  @MaxLength(200)
  idempotencyKey!: string;

  @IsString()
  @MaxLength(160)
  contentHash!: string;

  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  byteSize!: number;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  displayName?: string;

  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}