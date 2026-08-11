import { Matches } from 'class-validator';

export class ActivateStationDto {
  @Matches(/^KHE-\d{6}$/)
  code!: string;
}
