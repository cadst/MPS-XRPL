// 구독서비스 
import { IsIn, IsInt, Min } from 'class-validator';

export class SubscribeDto {
  @IsIn(['standard', 'business'])
  tier!: 'standard' | 'business';

  // 리워드 사용(원) – 0 이상 정수
  @IsInt()
  @Min(0)
  use_rewards!: number;
}
