import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
  newPassword!: string;
}
