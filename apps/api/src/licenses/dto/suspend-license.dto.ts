import { IsString, MinLength } from 'class-validator';

export class SuspendLicenseDto {
  @IsString()
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres' })
  reason!: string;
}
