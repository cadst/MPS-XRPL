import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetMePlaysQueryDto {
  @ApiProperty({ description: '대상 음원 ID' })
  @Type(() => Number) @IsInt() @Min(1)
  musicId!: number;

  @ApiPropertyOptional({ description: '페이지', default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 20, minimum: 1, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 20;
}

export class MePlayRowDto {
  @ApiProperty({ example: 10001 }) @Type(() => Number) playId!: number;
  @ApiProperty({ example: '2025-09-08T12:34:56Z' }) playedAt!: string;
  @ApiProperty({ example: true }) @Type(() => Boolean) isValid!: boolean;
  @ApiPropertyOptional({ example: { ip: '1.2.3.4' }, description: '추가 메타' })
  meta?: Record<string, any> | null;

  // 리워드(있으면)
  @ApiPropertyOptional({ example: 333 }) @Type(() => Number) rewardId?: number | null;
  @ApiPropertyOptional({ example: '1' }) rewardCode?: '0'|'1'|'2'|'3' | null;
  @ApiPropertyOptional({ example: 25.0 }) @Type(() => Number) amount?: number | null;
  @ApiPropertyOptional({ example: 'pending' }) status?: 'pending'|'successed' | null;
}

export class MePlaysResponseDto {
  @ApiProperty({ example: 1 }) @Type(() => Number) page!: number;
  @ApiProperty({ example: 20 }) @Type(() => Number) limit!: number;
  @ApiProperty({ example: 0 }) @Type(() => Number) total!: number;
  @ApiProperty({ type: [MePlayRowDto] }) @Type(() => MePlayRowDto) items!: MePlayRowDto[];
}
