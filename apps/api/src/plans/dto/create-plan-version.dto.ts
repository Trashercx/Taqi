import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  MinLength,
} from 'class-validator';

const BILLING_PERIODS = ['monthly', 'yearly'] as const;
const OVERAGE_POLICIES = ['block', 'degrade', 'alert', 'charge'] as const;

/**
 * Instantanea de condiciones de un plan (SS6.4). priceAmount va en la unidad
 * minima entera de la moneda (centimos), nunca float (SS8 "Reglas criticas").
 */
export class CreatePlanVersionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(0)
  priceAmount!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsIn(BILLING_PERIODS)
  billingPeriod!: (typeof BILLING_PERIODS)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxBranches?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxProducts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxWarehouses?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  apiRequestLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  storageLimitMb?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featureFlags?: string[];

  @IsOptional()
  @IsIn(OVERAGE_POLICIES)
  overagePolicy?: (typeof OVERAGE_POLICIES)[number];
}
