export class RevenueCalendarQueryDto {
  yearMonth?: string // YYYY-MM (KST 기준), 미지정 시 현재월
}

export interface RevenueCalendarDayDto {
  date: string // YYYY-MM-DD
  subscriptionRevenue: number
  usageRevenue: number
  totalRevenue: number
}

export interface RevenueCalendarResponseDto {
  yearMonth: string
  days: RevenueCalendarDayDto[]
  monthlySummary: {
    subscriptionRevenue: number
    usageRevenue: number
    totalRevenue: number
  }
}
