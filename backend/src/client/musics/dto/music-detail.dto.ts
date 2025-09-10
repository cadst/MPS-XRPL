import { ApiProperty } from '@nestjs/swagger';

export class RewardInfoDto {
  @ApiProperty({ nullable: true }) reward_one!: string | null;
  @ApiProperty({ nullable: true }) reward_total!: string | null;
  @ApiProperty({ nullable: true }) reward_remain!: string | null;
  @ApiProperty({ nullable: true }) total_count!: number | null;
  @ApiProperty({ nullable: true }) remain_count!: number | null;
}

export class MusicDetailDto {
  @ApiProperty() id!: number;
  @ApiProperty() title!: string;
  @ApiProperty() artist!: string;
  @ApiProperty({ nullable: true }) cover_image_url!: string | null;

  @ApiProperty({ enum: ['FULL', 'INSTRUMENTAL'] })
  format!: 'FULL' | 'INSTRUMENTAL';

  @ApiProperty() has_lyrics!: boolean;
  @ApiProperty({ nullable: true }) lyrics_text!: string | null;       // 필요시
  @ApiProperty({ nullable: true }) lyrics_file_path!: string | null;  // 필요시

  @ApiProperty({ enum: [0, 1, 2] })
  grade_required!: 0 | 1 | 2;

  @ApiProperty() can_use!: boolean; // 로그인 + 등급 충족 여부

  @ApiProperty({ type: RewardInfoDto })
  reward!: RewardInfoDto;

  @ApiProperty() popularity!: number;
  @ApiProperty() created_at!: string;

  @ApiProperty({ nullable: true }) category_id!: number | null;
  @ApiProperty({ nullable: true }) category_name!: string | null;

  @ApiProperty({ nullable: true }) duration_sec!: number | null;
  @ApiProperty({ nullable: true }) price_per_play!: string | null;

  @ApiProperty() is_using!: boolean; // 현재 회사가 사용중인지
}

export class UseMusicResponseDto {
  @ApiProperty() using_id!: number;
  @ApiProperty() is_using!: boolean; // 항상 true
}
