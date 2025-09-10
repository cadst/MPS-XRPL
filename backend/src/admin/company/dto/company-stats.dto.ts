import { IsOptional, Matches } from 'class-validator'

export class CompanyTotalStatsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth?: string
}

export class CompanyTotalStatsResponseDto {
  total!: number
  asOf!: string
} 