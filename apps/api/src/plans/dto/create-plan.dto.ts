import { IsString, Matches, MinLength } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'code debe ser minusculas/numeros/guiones (identificador estable)',
  })
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}
