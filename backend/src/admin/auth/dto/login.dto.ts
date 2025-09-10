import { MinLength, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  adminId: string;

  @IsString()
  @MinLength(8)
  adminPw: string;
}
