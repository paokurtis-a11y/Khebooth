import { IsDateString, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const API_SUBSCRIPTION_PLANS = ['DISCOVERY', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const;
export type ApiSubscriptionPlan = (typeof API_SUBSCRIPTION_PLANS)[number];

export const API_SUBSCRIPTION_STATUSES = ['PROSPECT', 'PLAN_SELECTED', 'PAYMENT_PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'] as const;
export type ApiSubscriptionStatus = (typeof API_SUBSCRIPTION_STATUSES)[number];

export const API_PAYMENT_STATUSES = ['UNPAID', 'PENDING', 'PAID', 'OVERDUE', 'REFUNDED'] as const;
export type ApiPaymentStatus = (typeof API_PAYMENT_STATUSES)[number];

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
  @IsIn(API_SUBSCRIPTION_PLANS)
  subscriptionPlan?: ApiSubscriptionPlan;

  @IsOptional()
  @IsIn(API_SUBSCRIPTION_STATUSES)
  subscriptionStatus?: ApiSubscriptionStatus;

  @IsOptional()
  @IsIn(API_PAYMENT_STATUSES)
  paymentStatus?: ApiPaymentStatus;

  @IsOptional()
  @IsDateString()
  subscriptionStartedAt?: string;

  @IsOptional()
  @IsDateString()
  subscriptionEndsAt?: string;
}
