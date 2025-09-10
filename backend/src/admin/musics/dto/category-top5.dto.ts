export class CategoryTop5QueryDto {
  yearMonth?: string // YYYY-MM (KST 기준), 미지정 시 현재월
  limit?: number // 상위 N개, 기본값 5
}

export interface CategoryTop5ItemDto {
  category: string
  validPlays: number
  rank: number
}

export interface CategoryTop5ResponseDto {
  yearMonth: string
  items: CategoryTop5ItemDto[]
}
