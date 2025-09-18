import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator'
import { Transform } from 'class-transformer'

export class MusicRewardsSummaryQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth?: string

  @IsOptional()
  @Transform(({ value }) => value ? String(value).trim() : undefined)
  search?: string

  @IsOptional()
  @Transform(({ value }) => (value && String(value) !== 'all' ? Number(value) : undefined))
  categoryId?: number

  @IsOptional()
  @IsIn(['inst','normal','all'])
  musicType?: 'inst' | 'normal' | 'all'

  @IsOptional()
  @IsIn(['0', '1', '2', 'all'])
  grade?: '0' | '1' | '2' | 'all'

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @IsOptional()
  @IsIn(['music_id', 'title', 'artist', 'category', 'grade', 'musicType', 'monthlyLimit', 'rewardPerPlay', 'usageRate', 'validPlays', 'earned', 'companiesUsing', 'lastUsedAt'])
  sortBy?: 'music_id' | 'title' | 'artist' | 'category' | 'grade' | 'musicType' | 'monthlyLimit' | 'rewardPerPlay' | 'usageRate' | 'validPlays' | 'earned' | 'companiesUsing' | 'lastUsedAt'

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc'
}

export class MusicRewardsSummaryItemDto {
  musicId: number
  title: string
  artist: string
  category: string | null
  grade: 0 | 1 | 2
  validPlays: number
  earned: number
  companiesUsing: number
  lastUsedAt: string | null
  monthlyLimit: number | null
  usageRate: number | null
  rewardPerPlay?: number | null
}

export class MusicRewardsSummaryResponseDto {
  yearMonth: string
  total: number
  page: number
  limit: number
  items: MusicRewardsSummaryItemDto[]
} 