import { IsDateString, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStationProfileDto {
  @IsOptional() @IsString() @MaxLength(120) firstName?: string;
  @IsOptional() @IsString() @MaxLength(120) lastName?: string;
  @IsOptional() @IsString() @MaxLength(160) displayName?: string;
  @IsOptional() @IsString() @MaxLength(180) company?: string;
  @IsOptional() @IsString() @MaxLength(160) role?: string;
  @IsOptional() @IsEmail() @MaxLength(240) email?: string;
  @IsOptional() @IsString() @MaxLength(80) phone?: string;
  @IsOptional() @IsString() @MaxLength(320) address?: string;
  @IsOptional() @IsDateString() birthDate?: string | null;
  @IsOptional() @IsString() @MaxLength(160) city?: string;
  @IsOptional() @IsString() @MaxLength(160) country?: string;
  @IsOptional() @IsString() @MaxLength(1200) bio?: string;
}
