import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator'
import { Transform } from 'class-transformer'

export class MusicCompanyUsageQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth?: string

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @Transform(({ value }) => String(value).trim())
  search?: string
}

export class MusicCompanyUsageItemDto {
  rank!: number
  companyId!: number
  companyName!: string
  tier!: 'Free' | 'Standard' | 'Business'
  monthlyEarned!: number
  monthlyPlays!: number
}

export class MusicCompanyUsageResponseDto {
  yearMonth!: string
  total!: number
  page!: number
  limit!: number
  items!: MusicCompanyUsageItemDto[]
} 