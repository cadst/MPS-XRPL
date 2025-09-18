import { SQL, sql } from 'drizzle-orm'

export function buildMusicMonthlyRewardsQuery(params: {
  musicId: number
  endYear: number
  endMonth: number
  months: number
}): SQL {
  const { musicId, endYear, endMonth, months } = params
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
plays AS (
  SELECT 
    to_char(sb.month_start, 'YYYY-MM') AS ym,
    -- 유효재생 + 리워드 발생 기준의 호출 수
    COUNT(mp.*) FILTER (
      WHERE mp.is_valid_play = true
        AND mp.reward_code = '1'
        AND mp.use_case IN ('0', '1')
    ) AS music_calls,
    COUNT(mp.*) FILTER (
      WHERE mp.is_valid_play = true
        AND mp.reward_code = '1'
        AND mp.use_case = '2'
        AND EXISTS (
          SELECT 1 FROM musics m2
          WHERE m2.id = mp.music_id AND m2.inst = false
        )
    ) AS lyrics_calls,
    COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') AS valid_plays,
    COALESCE(SUM(CASE WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN mp.reward_amount::numeric ELSE 0 END), 0) AS earned,
    COUNT(DISTINCT CASE WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN mp.using_company_id END) AS companies_using
  FROM series_bounds sb
  LEFT JOIN music_plays mp 
    ON mp.music_id = ${musicId}
   AND mp.created_at >= sb.month_start 
   AND mp.created_at <= sb.month_end
  GROUP BY sb.month_start
)
SELECT 
  to_char(sb.month_start, 'YYYY-MM') AS label,
  COALESCE(p.music_calls, 0) AS music_calls,
  COALESCE(p.lyrics_calls, 0) AS lyrics_calls,
  COALESCE(p.valid_plays, 0) AS valid_plays,
  COALESCE(p.earned, 0) AS earned,
  COALESCE(p.companies_using, 0) AS companies_using,
  mmr.total_reward_count AS monthly_limit,
  mmr.remaining_reward_count AS monthly_remaining,
  mmr.reward_per_play AS reward_per_play,
  CASE
    WHEN mmr.total_reward_count IS NULL OR mmr.total_reward_count <= 0 THEN NULL
    WHEN mmr.remaining_reward_count IS NOT NULL THEN
      ROUND(((mmr.total_reward_count - mmr.remaining_reward_count)::numeric / NULLIF(mmr.total_reward_count, 0)) * 100, 0)
    WHEN p.earned IS NOT NULL AND mmr.reward_per_play IS NOT NULL AND (mmr.reward_per_play)::numeric > 0 THEN
      ROUND((LEAST((p.earned / NULLIF((mmr.reward_per_play)::numeric, 0)), mmr.total_reward_count)::numeric / NULLIF(mmr.total_reward_count, 0)) * 100, 0)
    WHEN p.valid_plays IS NOT NULL THEN
      ROUND((LEAST(p.valid_plays, mmr.total_reward_count)::numeric / NULLIF(mmr.total_reward_count, 0)) * 100, 0)
    ELSE NULL
  END AS usage_rate
FROM series_bounds sb
LEFT JOIN plays p ON p.ym = to_char(sb.month_start, 'YYYY-MM')
LEFT JOIN monthly_music_rewards mmr 
  ON mmr.music_id = ${musicId}
 AND mmr.year_month = to_char(sb.month_start, 'YYYY-MM')
ORDER BY sb.month_start ASC
  `
} 