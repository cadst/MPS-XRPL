import { ApiProperty } from '@nestjs/swagger';

export type TrackFormat = 'FULL' | 'INSTRUMENTAL';

/* ---------------- Reward ---------------- */
export class RewardInfoDto {
  @ApiProperty({ type: String, nullable: true, description: '1회 리워드' })
  reward_one!: string | null;

  @ApiProperty({ type: String, nullable: true, description: '총 리워드 (total_count * reward_one)' })
  reward_total!: string | null;

  @ApiProperty({ type: String, nullable: true, description: '남은 리워드 (remain_count * reward_one)' })
  reward_remain!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: '이번 달 총 리워드 횟수' })
  total_count!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: '이번 달 남은 리워드 횟수' })
  remain_count!: number | null;
}

/* ---------------- Popular Music ---------------- */
export class PopularMusicDto {
  @ApiProperty() id!: number;

  @ApiProperty() title!: string;

  @ApiProperty() artist!: string;

  @ApiProperty({ type: String, nullable: true })
  cover_image_url?: string | null;

  @ApiProperty({ enum: ['FULL', 'INSTRUMENTAL'] })
  format!: TrackFormat;

  @ApiProperty() has_lyrics!: boolean;

  @ApiProperty({ enum: [0, 1, 2], description: '0=free, 1=standard, 2=business' })
  grade_required!: 0 | 1 | 2;

  @ApiProperty()
  can_use!: boolean;

  @ApiProperty({ type: RewardInfoDto })
  reward!: RewardInfoDto;

  @ApiProperty({ description: '최근 30일 유효 재생수' })
  popularity!: number;

  @ApiProperty({ description: '업로드일' })
  created_at!: Date;

  @ApiProperty({ type: String, nullable: true })
  category?: string | null;
}
