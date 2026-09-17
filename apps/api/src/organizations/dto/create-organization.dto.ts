import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

const STATUSES = [
  'prospecto',
  'prueba',
  'activo',
  'moroso',
  'suspendido',
  'cerrado',
] as const;

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  legalName!: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsString()
  ruc?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string;
}
