import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

// "voided" excluido: esa transicion es exclusiva de POST .../void (con
// motivo obligatorio), no un valor mas que aceptar aqui.
const UPDATE_STATUSES = ['pending', 'partial', 'paid', 'overdue'] as const;

/**
 * amount/currency/type no son editables a proposito: en un registro
 * financiero, "corregir" un monto rompe la trazabilidad. La forma correcta
 * es anular (POST .../void) y crear un movimiento nuevo.
 */
export class UpdateFinancialTransactionDto {
  /** Optimistic locking (SS8): version que el cliente leyo antes de editar. */
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  counterparty?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsOptional()
  @IsISO8601()
  paidAt?: string;

  @IsOptional()
  @IsIn(UPDATE_STATUSES)
  status?: (typeof UPDATE_STATUSES)[number];
}
