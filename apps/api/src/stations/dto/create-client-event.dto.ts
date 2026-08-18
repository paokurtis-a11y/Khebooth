import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  description!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
