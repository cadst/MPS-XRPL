import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator'
import { Transform } from 'class-transformer'

export class MusicMonthlyRewardsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  endYearMonth?: string 
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number 
}

export class MusicMonthlyRewardsItemDto {
  label!: string 
  musicCalls!: number
  lyricsCalls!: number
  validPlays!: number
  companiesUsing!: number
  monthlyLimit!: number | null
  usageRate!: number | null 
  earned!: number 
  rewardPerPlay!: number | null
}

export class MusicMonthlyRewardsResponseDto {
  labels!: string[] 
  items!: MusicMonthlyRewardsItemDto[]
  meta!: { endYearMonth: string; months: number }
} 