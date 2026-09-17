import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

const TYPES = ['income', 'expense'] as const;
// "voided" queda excluido a proposito: solo se llega ahi via POST .../void,
// nunca en la creacion (SS6.7: los movimientos se anulan, no nacen anulados).
const CREATE_STATUSES = ['pending', 'partial', 'paid', 'overdue'] as const;

export class CreateFinancialTransactionDto {
  @IsIn(TYPES)
  type!: (typeof TYPES)[number];

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsString()
  counterparty?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  /** Unidad minima entera de la moneda (centimos), nunca float (SS8). */
  @IsInt()
  @Min(1)
  amount!: number;

  /** Tipo de cambio escalado x10000 (37500 = 3.7500). Ver nota en schema.prisma. */
  @IsOptional()
  @IsInt()
  @Min(1)
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsISO8601()
  issuedAt!: string;

  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @IsOptional()
  @IsISO8601()
  paidAt?: string;

  @IsOptional()
  @IsIn(CREATE_STATUSES)
  status?: (typeof CREATE_STATUSES)[number];
}
