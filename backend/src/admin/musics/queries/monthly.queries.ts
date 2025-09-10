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
    COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true) AS valid_plays,
    COALESCE(SUM(CASE WHEN mp.is_valid_play = true THEN mp.reward_amount::numeric ELSE 0 END), 0) AS earned,
    COUNT(DISTINCT CASE WHEN mp.is_valid_play = true THEN mp.using_company_id END) AS companies_using
  FROM series_bounds sb
  LEFT JOIN music_plays mp 
    ON mp.music_id = ${musicId}
   AND mp.created_at >= sb.month_start 
   AND mp.created_at <= sb.month_end
  GROUP BY sb.month_start
)
SELECT 
  to_char(sb.month_start, 'YYYY-MM') AS label,
  COALESCE(p.valid_plays, 0) AS valid_plays,
  COALESCE(p.earned, 0) AS earned,
  COALESCE(p.companies_using, 0) AS companies_using,
  mmr.total_reward_count AS monthly_limit,
  mmr.remaining_reward_count AS monthly_remaining,
  mmr.reward_per_play AS reward_per_play
FROM series_bounds sb
LEFT JOIN plays p ON p.ym = to_char(sb.month_start, 'YYYY-MM')
LEFT JOIN monthly_music_rewards mmr 
  ON mmr.music_id = ${musicId}
 AND mmr.year_month = to_char(sb.month_start, 'YYYY-MM')
ORDER BY sb.month_start ASC
  `
} 