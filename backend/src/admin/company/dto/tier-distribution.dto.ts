export class TierDistributionQueryDto {
  yearMonth?: string // YYYY-MM (KST 기준), 미지정 시 현재월
}

export interface TierDistributionResponseDto {
  yearMonth: string
  free: number
  standard: number
  business: number
  total: number
}
