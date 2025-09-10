import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const REWARD_CODE_EARNING: '0' | '1' | '2' | '3' = '1'; 

export class GetMeRewardsQueryDto {
  @ApiPropertyOptional({ description: '최근 N일 집계(1~60)', default: 7, minimum: 1, maximum: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60)
  days?: number = 7;

  @ApiPropertyOptional({ description: '특정 음원만 조회할 때 ID' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  musicId?: number;
}

export class MeRewardDailyDto {
  @ApiProperty({ example: '2025-09-01' }) date!: string;
  @ApiProperty({ example: 120.0 }) @Type(() => Number) amount!: number;
}

export class MeRewardItemDto {
  @ApiProperty({ example: 3 }) @Type(() => Number) musicId!: number;
  @ApiPropertyOptional({ example: '미친 것 같아' }) title: string | null = null;
  @ApiPropertyOptional({ example: 'https://...' }) coverImageUrl: string | null = null;

  @ApiPropertyOptional({ example: '/api/music/3/play' }) playEndpoint?: string;
  @ApiPropertyOptional({ example: '/api/lyric/3/download' }) lyricsEndpoint?: string;

  @ApiPropertyOptional({ example: '2025-08-12T10:11:22Z', description: '사용 시작일(첫 재생)' })
  startDate: string | null = null;

  @ApiProperty({ example: 25.0 })  @Type(() => Number) monthBudget!: number;      // total_reward_count * reward_per_play
  @ApiProperty({ example: 180.0 }) @Type(() => Number) monthSpent!: number;       // 이번달 발생 합계 (pending+successed)
  @ApiProperty({ example: 2320.0 })@Type(() => Number) monthRemaining!: number;   // budget - spent (>=0)

  @ApiPropertyOptional({ example: 25.0 }) @Type(() => Number) rewardPerPlay: number | null = null;
  @ApiPropertyOptional({ example: 91 })   @Type(() => Number) remainingByPlanCount: number | null = null;
  @ApiPropertyOptional({ example: 2275.0 })@Type(() => Number) remainingByPlanAmount: number | null = null;

  @ApiProperty({ example: 5320.0 }) @Type(() => Number) lifetimeExtracted!: number; // 회사+음원 누적 발생
  @ApiPropertyOptional({ example: '2025-09-07T03:11:22Z' }) lastUsedAt: string | null = null;

  @ApiProperty({ type: [MeRewardDailyDto] }) @Type(() => MeRewardDailyDto)
  daily!: MeRewardDailyDto[];
}

export class MeRewardsTotalsDto {
  @ApiProperty({ example: 6000.0 }) @Type(() => Number) monthBudget!: number;
  @ApiProperty({ example: 540.0 })  @Type(() => Number) monthSpent!: number;
  @ApiProperty({ example: 5460.0 }) @Type(() => Number) monthRemaining!: number;
  @ApiProperty({ example: 12000.0 })@Type(() => Number) lifetimeExtracted!: number;
}

export class MeRewardsResponseDto {
  @ApiProperty({ example: '2025-09' }) month!: string;
  @ApiProperty({ example: 7 }) @Type(() => Number) days!: number;
  @ApiProperty({ type: [MeRewardItemDto] }) @Type(() => MeRewardItemDto) items!: MeRewardItemDto[];
  @ApiProperty({ type: MeRewardsTotalsDto }) @Type(() => MeRewardsTotalsDto) totals!: MeRewardsTotalsDto;
}
