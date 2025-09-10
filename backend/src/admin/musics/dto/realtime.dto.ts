export class RealtimeApiStatusQueryDto {
  limit?: number // 최근 N개, 기본값 5
}

export interface RealtimeApiStatusItemDto {
  status: 'success' | 'error'
  endpoint: string
  callType: string
  validity: string
  company: string
  timestamp: string
}

export interface RealtimeApiStatusResponseDto {
  items: RealtimeApiStatusItemDto[]
}

export class RealtimeTopTracksQueryDto {
  limit?: number // 상위 N개, 기본값 10
}

export interface RealtimeTopTracksItemDto {
  rank: number
  title: string
  validPlays: number
  totalPlays: number
  validRate: number
}

export interface RealtimeTopTracksResponseDto {
  items: RealtimeTopTracksItemDto[]
}

export class RealtimeTransactionsQueryDto {
  limit?: number // 최근 N개, 기본값 3
}

export interface RealtimeTransactionsItemDto {
  timestamp: string
  status: 'success' | 'pending' | 'failed'
  processedCount: string
  gasFee: string
  hash: string
}

export interface RealtimeTransactionsResponseDto {
  items: RealtimeTransactionsItemDto[]
}
