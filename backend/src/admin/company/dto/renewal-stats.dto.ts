export class RenewalStatsQueryDto {
  yearMonth?: string
}

export interface RenewalStatsResponseDto {
  asOf: string
  prevActive: number
  currActive: number
  retained: number
  churned: number
  reactivated: number
  rate: number | null
}


