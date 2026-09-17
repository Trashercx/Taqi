import { IsString, Matches, MinLength } from 'class-validator';

export class CreateCostCenterDto {
  @IsString()
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'code debe ser minusculas/numeros/guiones',
  })
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}
