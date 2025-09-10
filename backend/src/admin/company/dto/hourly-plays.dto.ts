export class HourlyPlaysQueryDto {
  date?: string // YYYY-MM-DD (KST 기준), 미지정 시 오늘
}

export interface HourlyPlaysResponseDto {
  date: string
  labels: string[] // ['0시', ... '23시']
  free: number[]
  standard: number[]
  business: number[]
  prevAvg: number[] // 전일 평균(등급 3개 평균)
}


