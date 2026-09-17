import { IsISO8601, IsOptional, Matches } from 'class-validator';

export class UsageSummaryQueryDto {
  @IsOptional()
  @Matches(/^[a-z][a-z0-9_]*$/)
  metric?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
