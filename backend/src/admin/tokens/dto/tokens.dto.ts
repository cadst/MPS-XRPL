import { IsOptional, IsString, IsDateString } from 'class-validator'

export class TokenInfoDto {
  // 토큰 정보 조회용 DTO (파라미터 없음)
}

export class WalletInfoDto {
  // 지갑 정보 조회용 DTO (파라미터 없음)
}

export class DailyBatchesDto {
  @IsOptional()
  @IsString()
  limit?: string = '10'

  @IsOptional()
  @IsString()
  offset?: string = '0'
}

export class BatchDetailDto {
  @IsString()
  date: string // YYYY-MM-DD 형식
}

export class TransactionsDto {
  @IsOptional()
  @IsString()
  limit?: string = '20'

  @IsOptional()
  @IsString()
  offset?: string = '0'
}

export class TransactionDetailDto {
  @IsString()
  id: string // 트랜잭션 ID
}
