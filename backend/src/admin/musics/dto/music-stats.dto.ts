import { IsOptional, Matches } from 'class-validator'

export class MusicTotalStatsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth?: string
}

export class MusicTotalStatsResponseDto {
  total!: number
  asOf!: string
}