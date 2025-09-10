import { IsOptional, Matches } from 'class-validator'

export class RewardsFilledStatsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth?: string
}

export class RewardsFilledStatsResponseDto {
  eligible!: number // total_reward_count > 0
  filled!: number // remaining_reward_count <= 0
  ratio!: number | null // eligible>0 ? filled/eligible*100 : null
  asOf!: string // YYYY-MM
} 