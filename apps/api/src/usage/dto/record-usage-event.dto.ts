import {
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class RecordUsageEventDto {
  @IsUUID()
  organizationId!: string;

  /**
   * Texto libre a proposito (no enum): SS6.6 deja la lista de metricas
   * abierta ("en el futuro: documentos SUNAT, CDR..."). Metricas usadas por
   * el calculo de cuotas (ver quota-status.ts): "api_request", "storage_mb".
   */
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'metric debe ser snake_case en minusculas (ej: api_request)',
  })
  metric!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
