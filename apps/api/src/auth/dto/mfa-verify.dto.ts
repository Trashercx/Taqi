import { IsString, Length } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  @Length(6, 10)
  code!: string;
}
