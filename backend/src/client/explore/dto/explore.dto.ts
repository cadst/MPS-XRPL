export type CompanyGrade = 'free'|'standard'|'business';
export type TrackFormat = 'FULL'|'INSTRUMENTAL';

export class RewardInfoDto {
  reward_one: string | null;   // numeric → string
  reward_total: string | null; // total_count * reward_one
  reward_remain: string | null;// remain_count * reward_one
  total_count: number | null;
  remain_count: number | null;
}

export class ExploreTrackDto {
    access!: {
        is_guest: boolean;                 // 게스트 여부
        requires_login: boolean;           // 액션시 로그인 필요
        can_use: boolean;                  // 로그인했고 등급도 통과?
        reason: 'OK'|'LOGIN_REQUIRED'|'SUBSCRIPTION_REQUIRED';
      };
  id!: number;
  title!: string;
  artist!: string;
  cover_image_url?: string | null;

  format!: TrackFormat;     // FULL | INSTRUMENTAL
  has_lyrics!: boolean;     // 가사 존재 여부

  grade_required!: 0|1|2;   // 0=모두, 1/2=구독 필요
  can_use!: boolean;        // 회사 등급 기준 사용 가능

  reward!: RewardInfoDto;   // 이번 달 리워드 요약
  popularity!: number;      // 최근 30일 유효재생 수
  created_at!: string;
}

export class ExploreSectionDto {
  key!: string;
  title!: string;
  items!: ExploreTrackDto[];
}

export class ExploreSectionsDto {
  featured!: ExploreTrackDto[];
  news!: ExploreSectionDto;
  charts!: ExploreSectionDto;
  moods!: ExploreSectionDto;
}
