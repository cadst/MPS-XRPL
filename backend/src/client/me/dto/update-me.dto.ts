// apps/backend/src/client/me/dto/update-profile.dto.ts
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() ceo_name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsUrl({}, { message: 'homepage_url must be a valid URL' })
  homepage_url?: string;
  @IsOptional() @IsString() profile_image_url?: string;
}
