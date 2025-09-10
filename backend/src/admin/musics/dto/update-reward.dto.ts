import { IsNumber, Min, IsOptional, IsBoolean } from 'class-validator';

export class UpdateRewardDto {
  @IsNumber()
  @Min(0)
  totalRewardCount!: number;

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