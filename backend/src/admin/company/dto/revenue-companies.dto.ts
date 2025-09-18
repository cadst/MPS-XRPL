import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator'

export class RevenueCompaniesQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth?: string // YYYY-MM (KST 기준), 미지정 시 현재월

  @IsOptional()
  @IsIn(['standard', 'business'])
  grade?: 'standard' | 'business' // 등급 필터

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number // 상위 N개, 기본값 5
}

export interface RevenueCompaniesItemDto {
  rank: number
  companyId: number
  companyName: string
  grade: string
  subscriptionRevenue: number
  usageRevenue: number
  totalRevenue: number
  percentage: number
  growth: string // 전월 대비 증감률
}

export interface RevenueCompaniesResponseDto {
  yearMonth: string
  grade: string
  items: RevenueCompaniesItemDto[]
}
