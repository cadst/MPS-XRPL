import { IsOptional, Matches } from 'class-validator'

export class RewardUsageStatsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth?: string
}

export class RewardUsageStatsResponseDto {
  budget!: number // 월 리워드 예산(토큰): sum(total_reward_count * reward_per_play)
  used!: number // 해당 월 기간 내 지급된 리워드 합(토큰)
  usageRate!: number | null // budget>0 ? used/budget*100 : null
  asOf!: string // YYYY-MM
} 