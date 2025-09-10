// src/playlists/dto/create-playlist.dto.ts
import { IsArray, IsInt, IsOptional, IsString, MaxLength, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlaylistDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  trackIds?: number[];
}
