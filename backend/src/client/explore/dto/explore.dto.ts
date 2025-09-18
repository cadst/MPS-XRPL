export type ExploreTrackDto = {
  id: number;
  title: string;
  artist: string | null;
  cover_image_url: string | null;
  format: 'FULL' | 'INSTRUMENTAL';
  price_per_play: number | null;
  has_lyrics: boolean;
  category_id?: number | null;   
  category_name?: string | null; 
  grade_required: 0 | 1 | 2;             // 0=무료, 1/2=구독
  can_use: boolean;                      // 로그인+등급 통과 시 true
  access_type: 'FREE' | 'SUBSCRIPTION';  // 라벨
  locked: boolean;                       // 잠금 오버레이/클릭 차단
  reason: 'OK' | 'LOGIN_REQUIRED' | 'SUBSCRIPTION_REQUIRED';

  reward: {
    reward_one: number | null;
    reward_total: number | null;
    reward_remain: number | null;
    total_count: number | null;
    remain_count: number | null;
  };
  reward_type: 'REWARD' | 'NO_REWARD';   // 이번 달 리워드 트랙인지
  reward_active: boolean;                // 남은 리워드 > 0

  popularity?: number | null;
  created_at: string | Date;
};

export type ExploreSectionDto = {
  key: 'featured' | 'news' | 'charts' | 'moods';
  title: string;
  items: ExploreTrackDto[];
};

export type ExploreSectionsDto = {
  featured: ExploreSectionDto;
  news: ExploreSectionDto;
  charts: ExploreSectionDto;
  moods: ExploreSectionDto;
};
