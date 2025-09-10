import { IsOptional, Matches } from 'class-validator'

export class RevenueForecastQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  yearMonth?: string
}

export class RevenueForecastResponseDto {
  mtd!: number 
  forecast!: number 
  asOf!: string 
} 