import { IsOptional, IsIn } from 'class-validator'

export class SystemStatsDto {
  @IsOptional()
  @IsIn(['24h', '7d', '30d'])
  period?: '24h' | '7d' | '30d' = '24h'
}

export class SystemChartDto {
  @IsOptional()
  @IsIn(['24h', '7d', '30d'])
  period?: '24h' | '7d' | '30d' = '24h'
}

export class SystemKeysDto {
  @IsOptional()
  search?: string

  @IsOptional()
  @IsIn(['usage', 'recent', 'created'])
  sortBy?: 'usage' | 'recent' | 'created' = 'usage'

  @IsOptional()
  @IsIn(['desc', 'asc'])
  sortOrder?: 'desc' | 'asc' = 'desc'
}
