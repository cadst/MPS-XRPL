import { SQL, sql } from 'drizzle-orm'

export type TrendType = 'music' | 'lyrics'
export type TrendGranularity = 'daily' | 'monthly'
export type TrendSegment = 'category' | 'all'

const useCaseFilter = (type: TrendType) =>
  type === 'music' ? sql`mp.use_case IN ('0','1')` : sql`mp.use_case = '2'`

// 일별 추세 그래프 (유효재생 + 리워드 지급액 합계)
export function buildMusicTrendDailyQuery(params: {
  musicId: number
  year: number
  month: number
  type: TrendType
  segment: TrendSegment
}) {
  const { musicId, year, month, type, segment } = params

  return sql`
WITH month_range AS (
  SELECT
    make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') AS month_start,
    (make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second' AS month_end
),
-- days series (KST)
series AS (
  SELECT generate_series((SELECT month_start FROM month_range), (SELECT month_end FROM month_range), interval '1 day')::date AS d
),
-- current music daily
current_music AS (
  SELECT s.d AS d,
         COALESCE(SUM(CASE WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN mp.reward_amount::numeric ELSE 0 END), 0) AS cnt
  FROM series s
  LEFT JOIN music_plays mp ON mp.music_id = ${musicId}
    AND ${useCaseFilter(type)}
    AND mp.created_at >= (SELECT month_start FROM month_range)
    AND mp.created_at <= (SELECT month_end FROM month_range)
    AND DATE(mp.created_at AT TIME ZONE 'Asia/Seoul') = s.d
  GROUP BY s.d
),
-- industry average by day
base AS (
  SELECT m.category_id FROM musics m WHERE m.id = ${musicId} LIMIT 1
),
plays_by_music AS (
  SELECT s.d AS d, mp.music_id,
         COALESCE(SUM(CASE WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN mp.reward_amount::numeric ELSE 0 END), 0) AS cnt
  FROM series s
  LEFT JOIN music_plays mp ON ${useCaseFilter(type)}
    AND mp.created_at >= (SELECT month_start FROM month_range)
    AND mp.created_at <= (SELECT month_end FROM month_range)
    AND DATE(mp.created_at AT TIME ZONE 'Asia/Seoul') = s.d
  ${segment === 'category' ? sql`LEFT JOIN musics m ON m.id = mp.music_id` : sql``}
  ${segment === 'category' ? sql`WHERE (m.category_id = (SELECT category_id FROM base) OR mp.music_id IS NULL)` : sql``}
  GROUP BY s.d, mp.music_id
),
industry_avg AS (
  SELECT d, AVG(cnt)::numeric AS avg_cnt
  FROM plays_by_music
  GROUP BY d
)
SELECT
  to_char(s.d, 'YYYY-MM-DD') AS label,
  COALESCE(cm.cnt, 0) AS current_cnt,
  COALESCE(ia.avg_cnt, 0) AS industry_avg
FROM series s
LEFT JOIN current_music cm ON cm.d = s.d
LEFT JOIN industry_avg ia ON ia.d = s.d
ORDER BY s.d ASC
  `
}

// 월별 추세 그래프 (유효재생 + 리워드 지급액 합계)
export function buildMusicTrendMonthlyQuery(params: {
  musicId: number
  endYear: number
  endMonth: number
  months: number
  type: TrendType
  segment: TrendSegment
}) {
  const { musicId, endYear, endMonth, months, type, segment } = params

  return sql`
WITH end_point AS (
  SELECT make_timestamptz(${endYear}, ${endMonth}, 1, 0, 0, 0, 'Asia/Seoul') AS end_month
),
series AS (
  SELECT (end_month - (interval '1 month' * g.n))::date AS month_start
  FROM end_point, generate_series(${months - 1}, 0, -1) AS g(n)
),
series_bounds AS (
  SELECT month_start, (month_start + interval '1 month' - interval '1 second') AS month_end FROM series
),
current_music AS (
  SELECT to_char(sb.month_start, 'YYYY-MM') AS ym,
         COALESCE(SUM(CASE WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN mp.reward_amount::numeric ELSE 0 END), 0) AS cnt
  FROM series_bounds sb
  LEFT JOIN music_plays mp ON mp.music_id = ${musicId}
    AND ${useCaseFilter(type)}
    AND mp.created_at >= sb.month_start AND mp.created_at <= sb.month_end
  GROUP BY sb.month_start
),
base AS (
  SELECT m.category_id FROM musics m WHERE m.id = ${musicId} LIMIT 1
),
plays_by_music AS (
  SELECT to_char(sb.month_start, 'YYYY-MM') AS ym, mp.music_id,
         COALESCE(SUM(CASE WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN mp.reward_amount::numeric ELSE 0 END), 0) AS cnt
  FROM series_bounds sb
  LEFT JOIN music_plays mp ON ${useCaseFilter(type)}
    AND mp.created_at >= sb.month_start AND mp.created_at <= sb.month_end
  ${segment === 'category' ? sql`LEFT JOIN musics m ON m.id = mp.music_id` : sql``}
  ${segment === 'category' ? sql`WHERE (m.category_id = (SELECT category_id FROM base) OR mp.music_id IS NULL)` : sql``}
  GROUP BY sb.month_start, mp.music_id
),
industry_avg AS (
  SELECT ym, AVG(cnt)::numeric AS avg_cnt FROM plays_by_music GROUP BY ym
)
SELECT
  to_char(sb.month_start, 'YYYY-MM') AS label,
  COALESCE(cm.cnt, 0) AS current_cnt,
  COALESCE(ia.avg_cnt, 0) AS industry_avg
FROM series_bounds sb
LEFT JOIN current_music cm ON cm.ym = to_char(sb.month_start, 'YYYY-MM')
LEFT JOIN industry_avg ia ON ia.ym = to_char(sb.month_start, 'YYYY-MM')
ORDER BY sb.month_start ASC
  `
} 