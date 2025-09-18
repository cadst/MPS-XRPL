// lib/types.ts
export type Music = {
  id: number;
  title: string;
  artist: string;

  cover?: string;
  cover_image_url?: string;

  category_id: number;
  category_name?: string | null;

  // 가격/지표
  price?: number;
  amount?: number;
  views?: number;
  likes?: number;
  comments?: number;
  created_at?: string;

  // 리워드(서버 계산)
  reward_count: number;
  reward_amount: number;
  reward_total: number;
  reward_remaining: number;
};

export type Page<T> = {
  items: T[];
  nextCursor: number | null;
  hasMore?: boolean; 
};

export type Category = {
  category_id: number;
  category_name: string;
};