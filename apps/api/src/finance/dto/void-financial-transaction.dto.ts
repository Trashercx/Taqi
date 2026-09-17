import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class VoidFinancialTransactionDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres' })
  reason!: string;
}
