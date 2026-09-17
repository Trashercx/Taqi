import { IsOptional, IsString } from 'class-validator';

export class ReactivateLicenseDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
