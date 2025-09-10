import { IsOptional, Matches } from 'class-validator'

export class PlaysValidStatsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth?: string
}

export class PlaysValidStatsResponseDto {
  validPlays!: number
  totalPlays!: number
  rewardedPlays!: number
  rewardRate!: number
  asOf!: string
} 