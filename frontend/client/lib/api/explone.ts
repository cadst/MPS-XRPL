import { api } from './core/http';

export type AccessReason = 'OK' | 'LOGIN_REQUIRED' | 'SUBSCRIPTION_REQUIRED';

export type RewardInfo = {
  reward_one: number | null;   // ← number 권장
  reward_total: number | null;
  reward_remain: number | null;
  total_count: number | null;
  remain_count: number | null;
};

export type ExploreTrack = {
  id: number;
  title: string;
  artist: string | null;             // ← null 가능
  cover_image_url: string | null;
  has_lyrics: boolean;
  format: 'FULL' | 'INSTRUMENTAL';  
  category_id?: number | null;
  category_name?: string | null;
  price_per_play: number | null;   
  grade_required: 0 | 1 | 2;
  can_use: boolean;                  // 백엔드 계산 결과
  access_type: 'FREE' | 'SUBSCRIPTION';
  locked: boolean;
  reason: AccessReason;

  reward: RewardInfo;
  reward_type: 'REWARD' | 'NO_REWARD';
  reward_active: boolean;

  popularity?: number | null;
  created_at: string;                // (Date로 오면 서버에서 stringify됨)
};

export type ExploreSection = {
  key: 'featured' | 'news' | 'charts' | 'moods';
  title: string;
  items: ExploreTrack[];
};

export type ExploreSections = {
  featured: ExploreSection;          // ← 배열(X) 섹션 객체(O)
  news: ExploreSection;
  charts: ExploreSection;
  moods: ExploreSection;
};

// 필요하면 credentials 포함(쿠키 인증시)
export const getExploreSections = () =>
  api('/explore/sections') as Promise<ExploreSections>;
  // 만약 api 래퍼가 credentials를 안 붙여주면:
  // api('/explore/sections', { credentials: 'include' }) as Promise<ExploreSections>;
