export class RevenueCompaniesQueryDto {
  yearMonth?: string // YYYY-MM (KST 기준), 미지정 시 현재월
  grade?: 'standard' | 'business' // 등급 필터
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
