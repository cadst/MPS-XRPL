import { IsNumber, Min, IsOptional, IsBoolean, ValidateIf } from 'class-validator';

export class UpdateRewardDto {
  @ValidateIf(o => !o.removeReward)
  @IsNumber()
  @Min(0)
  totalRewardCount!: number;

  @ValidateIf(o => !o.removeReward)
  @IsNumber()
  @Min(0)
  rewardPerPlay!: number;

  @IsOptional()
  @IsBoolean()
  removeReward?: boolean;

  @IsOptional()
  @IsNumber()
  grade?: 0 | 2;
} 