import { IsOptional, Matches } from 'class-validator'

export class RewardsDetailQueryDto {
    @IsOptional()
    @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'yearMonth는 YYYY-MM 형식이어야 합니다.' })
    yearMonth?: string
}