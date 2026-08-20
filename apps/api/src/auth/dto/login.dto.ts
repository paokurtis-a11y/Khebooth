import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  identifier?: string;

  // Backward compatibility for existing web/mobile clients that still send `email`.
  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
