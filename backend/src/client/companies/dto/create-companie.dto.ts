import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';


export class CreateCompanyDto {
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @IsString() @MaxLength(20)
  business_number!: string; 

  @IsEmail() @MaxLength(190)
  email!: string;

  @IsString() @MinLength(8)
  password!: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(80)
  ceo_name?: string;

  @IsOptional() @IsString()
  profile_image_url?: string;

  @IsOptional() @IsString()
  homepage_url?: string;
}
