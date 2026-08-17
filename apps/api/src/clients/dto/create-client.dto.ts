import { PAYMENT_STATUSES, SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUSES } from '@khe/contracts';
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  @IsOptional()
  @IsIn(SUBSCRIPTION_PLANS)
  subscriptionPlan?: (typeof SUBSCRIPTION_PLANS)[number];

  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  subscriptionStatus?: (typeof SUBSCRIPTION_STATUSES)[number];

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: (typeof PAYMENT_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  subscriptionStartedAt?: string;

  @IsOptional()
  @IsDateString()
  subscriptionEndsAt?: string;
}
