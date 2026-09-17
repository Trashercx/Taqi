import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ROLE_SEEDS } from '../../rbac/roles.seed-data';

const ROLE_CODES = ROLE_SEEDS.map((role) => role.code);

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  fullName?: string;

  @IsOptional()
  @IsIn(ROLE_CODES)
  roleCode?: string;
}
