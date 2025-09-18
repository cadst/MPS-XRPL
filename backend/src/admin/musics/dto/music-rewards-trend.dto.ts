import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator'
import { Transform } from 'class-transformer'

export class MusicRewardsTrendQueryDto {
  @IsIn(['daily', 'monthly'])
  granularity!: 'daily' | 'monthly'

  @IsIn(['music', 'lyrics'])
  type!: 'music' | 'lyrics'

  @IsOptional()
  @IsIn(['category', 'all'])
  segment?: 'category' | 'all'

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth?: string

  @IsOptional()
  @Transform(({ value }) => value === undefined || value === null ? undefined : Number(value))
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number
}

export class MusicRewardsTrendSeriesDto {
  label!: string
  data!: number[]
}

export class MusicRewardsTrendResponseDto {
  labels!: string[]
  series!: MusicRewardsTrendSeriesDto[]
  meta!: { granularity: 'daily' | 'monthly'; type: 'music' | 'lyrics'; segment: 'category' | 'all'; yearMonth?: string; months?: number }
} 