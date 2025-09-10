import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayUnique, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class RemoveTracksDto {
  @ApiProperty({ type: [Number], description: '삭제할 트랙(=music_id) 목록' })
  @IsArray() @ArrayUnique() @Type(() => Number) @IsInt({ each: true })
  trackIds!: number[];
}