import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RenewLicenseDto {
  @IsOptional()
  @IsUUID()
  planVersionId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
