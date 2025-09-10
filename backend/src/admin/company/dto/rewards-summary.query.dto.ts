import { IsOptional, IsInt, Min, Max, IsIn, Matches } from 'class-validator'
import { Transform } from 'class-transformer'

const VALID_SORT_BY = [
  'company_id', 'name', 'grade', 'total_tokens', 'monthly_earned',
  'monthly_used', 'usage_rate', 'active_tracks',
] as const

export class RewardsSummaryQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'yearMonth는 YYYY-MM 형식이어야 합니다.' })
  yearMonth?: string

  @IsOptional()
  search?: string

  @IsOptional()
  @IsIn(['free', 'standard', 'business', 'all'])
  tier?: 'free' | 'standard' | 'business' | 'all'

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number

  @IsOptional()
  @IsIn(VALID_SORT_BY as unknown as string[])
  sortBy?: typeof VALID_SORT_BY[number]

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc'
}
