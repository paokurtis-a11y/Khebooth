import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  firstName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
