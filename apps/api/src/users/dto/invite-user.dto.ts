import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ROLE_SEEDS } from '../../rbac/roles.seed-data';

const ROLE_CODES = ROLE_SEEDS.map((role) => role.code);

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsIn(ROLE_CODES)
  roleCode!: string;
}
