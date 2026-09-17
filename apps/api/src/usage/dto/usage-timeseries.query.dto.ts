import { IsIn, IsISO8601, IsOptional, IsUUID, Matches } from 'class-validator';

const GRANULARITIES = ['hour', 'day'] as const;

export class UsageTimeseriesQueryDto {
  @Matches(/^[a-z][a-z0-9_]*$/)
  metric!: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsIn(GRANULARITIES)
  granularity?: (typeof GRANULARITIES)[number];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
