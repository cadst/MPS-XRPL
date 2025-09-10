import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayUnique, IsEnum, IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class UsePlaylistDto {
  @ApiProperty({ type: [Number], required: false, description: '없으면 전곡 사용' })
  @IsOptional() @IsArray() @ArrayUnique() @Type(() => Number) @IsInt({ each: true })
  trackIds?: number[];

  @ApiProperty({ enum: ['full','intro','lyrics'], required: false, default: 'full' })
  @IsOptional() @IsEnum(['full','intro','lyrics'])
  useCase?: 'full'|'intro'|'lyrics';
}