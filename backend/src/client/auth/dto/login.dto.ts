import { IsEmail,IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
    @IsEmail() @MaxLength(190)
    email!: string;
    @IsString() @MinLength(8)
    password!: string;
}