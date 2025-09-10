import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayUnique, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlaylistDto {
  @ApiProperty({ type: [Number], description: '이 배열로 트랙을 완전히 교체' })
  @IsArray() @ArrayUnique() @Type(() => Number) @IsInt({ each: true })
  trackIds!: number[];
}