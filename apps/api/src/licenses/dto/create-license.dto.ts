import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

const START_STATUSES = ['draft', 'trial', 'active'] as const;

export class CreateLicenseDto {
  @IsUUID()
  organizationId!: string;

  @IsUUID()
  planVersionId!: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  /**
   * Si se omite: "trial" cuando el PlanVersion tiene dias de prueba, si no
   * "active". Forzar "draft" sirve para dejar una licencia preparada sin
   * que empiece a correr el periodo todavia.
   */
  @IsOptional()
  @IsIn(START_STATUSES)
  startStatus?: (typeof START_STATUSES)[number];
}
