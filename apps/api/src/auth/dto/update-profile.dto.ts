import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;
}
