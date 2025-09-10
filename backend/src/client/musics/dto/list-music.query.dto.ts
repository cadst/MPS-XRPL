// apps/backend/src/client/musics/dto/list-music.query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export type SearchMode = 'keyword'|'semantic';
export type SortKey = 'relevance'|'newest'|'most_played'|'remaining_reward';
export type StatusKey = 'active'|'inactive'|'invalid';

export class ListMusicQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;

  @ApiPropertyOptional({ enum: ['keyword','semantic'] })
  @IsOptional() @IsEnum(['keyword','semantic'])
  mode?: SearchMode = 'keyword';

  @ApiPropertyOptional() @IsOptional() @IsBooleanString() explain?: string; // 'true'|'false'

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1)
  @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  min_similarity?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() category_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mood?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  reward_max?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
  remaining_reward_max?: number;

  @ApiPropertyOptional({ enum: ['active','inactive','invalid'] })
  @IsOptional() @IsEnum(['active','inactive','invalid'])
  status?: StatusKey;

  @ApiPropertyOptional({ enum: ['relevance','newest','most_played','remaining_reward'] })
  @IsOptional() @IsEnum(['relevance','newest','most_played','remaining_reward'])
  sort?: SortKey = 'relevance';

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(50)
  @Transform(({ value }) => value !== undefined ? Number(value) : 20)
  limit?: number = 20;

  @ApiPropertyOptional() @IsOptional() @IsString()
  cursor?: string; // base64 등 불투명 커서
}
