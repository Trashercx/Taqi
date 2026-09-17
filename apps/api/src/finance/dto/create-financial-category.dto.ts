import { IsIn, IsString, Matches, MinLength } from 'class-validator';

const KINDS = ['income', 'expense'] as const;

export class CreateFinancialCategoryDto {
  @IsString()
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'code debe ser minusculas/numeros/guiones',
  })
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(KINDS)
  kind!: (typeof KINDS)[number];
}
