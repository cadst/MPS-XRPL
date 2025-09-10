export type MonthRow = { ym: string };

export type MusicRow = {
  music_id: number;
  title: string | null;
  cover_image_url: string | null;
};

export type PlanRow = {
  reward_per_play: string | null;
  total_reward_count: number | null;
  remaining_reward_count: number | null;
};

export type AggRow = {
  month_spent: string;               // numeric -> text
  lifetime: string;                  // numeric -> text
  last_used_at: string | null;       // ISO text
  start_date: string | null;         // ISO text
};

export type DailyRow = {
  date: string;                      // 'YYYY-MM-DD'
  amount: string;                    // numeric -> text
};

export type PlaysCountRow = { c: string };

export type PlayListRow = {
  play_id: number;
  played_at: string;                 // ISO text
  is_valid: boolean;
  meta: any;
  reward_id: number | null;
  reward_code: '0'|'1'|'2'|'3' | null;
  amount: string | null;             // numeric -> text
  status: 'pending'|'successed' | null;
};
