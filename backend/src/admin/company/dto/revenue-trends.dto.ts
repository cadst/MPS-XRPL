export class RevenueTrendsQueryDto {
  year?: number // 연도, 미지정 시 현재년도
  months?: number // 월 수, 기본값 12
}

export interface RevenueTrendsItemDto {
  month: string // MM월
  subscriptionRevenue: {
    standard: number
    business: number
    total: number
  }
  usageRevenue: {
    general: number // 일반음원
    lyrics: number // 가사만
    instrumental: number // Inst음원
    total: number
  }
  totalRevenue: number
}

export interface RevenueTrendsResponseDto {
  year: number
  items: RevenueTrendsItemDto[]
}
