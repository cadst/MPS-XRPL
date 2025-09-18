import { sql } from 'drizzle-orm'
import { musics } from '../../../db/schema/musics'
import { music_plays } from '../../../db/schema/music_plays'
import { companies } from '../../../db/schema/companies'
import { buildMonthRangeCTE } from './common.queries'

export function buildMusicStatsCountQuery(year: number, month: number) {
  const endTsSql = sql`
    (make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second'
  `
  
  return sql`
    SELECT COUNT(*)::int AS total
    FROM ${musics} m
    WHERE m.created_at <= ${endTsSql}
  `
}

export function buildMusicStatsQuery(year: number, month: number) {
  const cte = buildMonthRangeCTE(year, month)
  
  return sql`
    ${cte}
    SELECT
      m.id,
      m.title,
      m.artist,
      m.created_at,
      COALESCE(COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1'), 0)::int AS valid_plays,
      COALESCE(SUM(mp.reward_amount::numeric) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1'), 0) AS earned_rewards,
      COALESCE(COUNT(DISTINCT mp.using_company_id) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1'), 0)::int AS companies_using,
      MAX(mp.created_at) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') AS last_used_at
    FROM musics m
    LEFT JOIN music_plays mp ON mp.music_id = m.id
      AND mp.created_at >= (SELECT month_start FROM month_range)
      AND mp.created_at <= (SELECT month_end FROM month_range)
    GROUP BY m.id, m.title, m.artist, m.created_at
    ORDER BY valid_plays DESC, earned_rewards DESC
  `
}

export function buildMusicStatsCurrentQuery(year: number, month: number) {
  const cte = buildMonthRangeCTE(year, month)
  
  return sql`
    ${cte}
    SELECT 
      m.id,
      m.title,
      m.artist,
      m.created_at,
      COALESCE(COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1'), 0)::int AS valid_plays,
      COALESCE(SUM(mp.reward_amount::numeric) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1'), 0) AS earned_rewards,
      COALESCE(COUNT(DISTINCT mp.using_company_id) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1'), 0)::int AS companies_using,
      MAX(mp.created_at) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') AS last_used_at
    FROM musics m
    LEFT JOIN music_plays mp ON mp.music_id = m.id
      AND mp.created_at >= (SELECT month_start FROM month_range)
      AND mp.created_at <= (SELECT month_end FROM month_range)
    GROUP BY m.id, m.title, m.artist, m.created_at
    ORDER BY valid_plays DESC, earned_rewards DESC
  `
}

export function buildMusicStatsPastQuery(year: number, month: number) {
  const cte = buildMonthRangeCTE(year, month)
  
  return sql`
    ${cte}
    SELECT 
      m.id,
      m.title,
      m.artist,
      m.created_at,
      COALESCE(COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1'), 0)::int AS valid_plays,
      COALESCE(SUM(mp.reward_amount::numeric) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1'), 0) AS earned_rewards,
      COALESCE(COUNT(DISTINCT mp.using_company_id) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1'), 0)::int AS companies_using,
      MAX(mp.created_at) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') AS last_used_at
    FROM musics m
    LEFT JOIN music_plays mp ON mp.music_id = m.id
      AND mp.created_at >= (SELECT month_start FROM month_range)
      AND mp.created_at <= (SELECT month_end FROM month_range)
    GROUP BY m.id, m.title, m.artist, m.created_at
    ORDER BY valid_plays DESC, earned_rewards DESC
  `
}

export function buildMusicCompanyUsageQuery(musicId: number, year: number, month: number) {
  const cte = buildMonthRangeCTE(year, month)
  
  return sql`
    ${cte}
    , plays AS (
      SELECT mp.using_company_id AS company_id,
             COUNT(*) AS monthly_plays,
             COALESCE(SUM(CASE WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN mp.reward_amount::numeric ELSE 0 END), 0) AS monthly_earned
      FROM music_plays mp, month_range mr
      WHERE mp.music_id = ${musicId}
        AND mp.created_at >= mr.month_start AND mp.created_at <= mr.month_end
      GROUP BY mp.using_company_id
    )
    SELECT 
      p.company_id,
      p.monthly_plays,
      p.monthly_earned,
      c.name as company_name,
      c.grade
    FROM plays p
    LEFT JOIN companies c ON c.id = p.company_id
    WHERE TRUE
    ORDER BY p.monthly_earned DESC, p.monthly_plays DESC
  `
}

export function buildMusicPlaysQuery(musicId: number) {
  return sql`
    SELECT 
      mp.id,
      mp.created_at,
      mp.is_valid_play,
      mp.reward_code,
      mp.reward_amount,
      c.name as company_name,
      c.grade as company_grade
    FROM music_plays mp
    LEFT JOIN companies c ON c.id = mp.using_company_id
    WHERE mp.music_id = ${musicId}
    ORDER BY mp.created_at DESC
    LIMIT 100
  `
}

export function buildMusicPlaysStatsQuery(musicId: number) {
  return sql`
    SELECT 
      mp.created_at,
      mp.is_valid_play,
      mp.reward_code,
      mp.reward_amount,
      c.name as company_name,
      c.grade as company_grade
    FROM music_plays mp
    LEFT JOIN companies c ON c.id = mp.using_company_id
    WHERE mp.music_id = ${musicId}
    ORDER BY mp.created_at DESC
    LIMIT 100
  `
}

export function buildRewardsCountQuery(year: number, month: number) {
  const cte = buildMonthRangeCTE(year, month)
  
  return sql`
    ${cte}
    SELECT COUNT(*)::int AS rewarded
    FROM music_plays mp, month_range mr
    WHERE mp.created_at >= mr.month_start 
      AND mp.created_at <= mr.month_end
      AND mp.is_valid_play = true 
      AND mp.reward_code = '1'
  `
}

export function buildMusicRewardsCountQuery(musicId: number, year: number, month: number) {
  const cte = buildMonthRangeCTE(year, month)
  
  return sql`
    ${cte}
    SELECT COUNT(*)::int AS rewarded
    FROM rewards r, month_range mr
    WHERE r.music_id = ${musicId}
      AND r.reward_code = '1'
      AND r.created_at >= mr.month_start AND r.created_at <= mr.month_end
  `
}

export function buildValidPlaysStatsQuery(year: number, month: number) {
  const cte = buildMonthRangeCTE(year, month)
  
  return sql`
    ${cte}
    SELECT
      COUNT(*) FILTER (WHERE mp.is_valid_play = true)::bigint AS valid_plays,
      COUNT(*)::bigint AS total_plays,
      COUNT(*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1')::bigint AS rewarded_plays
    FROM music_plays mp, month_range mr
    WHERE mp.created_at >= mr.month_start AND mp.created_at <= mr.month_end
  `
}

export function buildRevenueForecastCurrentQuery(year: number, month: number) {
  const cte = buildMonthRangeCTE(year, month)
  
  return sql`
    ${cte}
    SELECT 
      COALESCE(SUM(subscription_revenue), 0) - COALESCE(SUM(usage_revenue), 0) AS mtd
    FROM (
      -- 구독료 (결제일 기준)
      SELECT 
        COALESCE(SUM(cs.actual_paid_amount), 0) AS subscription_revenue,
        0 AS usage_revenue
      FROM company_subscriptions cs
      JOIN companies c ON c.id = cs.company_id
      CROSS JOIN month_range mr
      WHERE c.grade <> 'free'
        AND DATE(cs.start_date AT TIME ZONE 'Asia/Seoul') >= mr.month_start
        AND DATE(cs.start_date AT TIME ZONE 'Asia/Seoul') <= NOW()
      
      UNION ALL
      
      -- 사용료 (유효재생 기준) - 차감
      SELECT 
        0 AS subscription_revenue,
        COALESCE(SUM(
          CASE 
            WHEN mp.use_case = '0' OR mp.use_case = '1' THEN m.price_per_play::numeric
            WHEN mp.use_case = '2' AND m.inst = false THEN m.lyrics_price::numeric
            ELSE 0
          END
        ), 0) AS usage_revenue
      FROM music_plays mp
      JOIN musics m ON m.id = mp.music_id
      CROSS JOIN month_range mr
      WHERE mp.is_valid_play = true
        AND mp.created_at >= mr.month_start
        AND mp.created_at <= NOW()
    ) revenue_data
  `
}

export function buildRevenueForecastPastQuery(year: number, month: number) {
  const cte = buildMonthRangeCTE(year, month)
  
  return sql`
    ${cte}
    SELECT 
      COALESCE(SUM(subscription_revenue), 0) - COALESCE(SUM(usage_revenue), 0) AS mtd
    FROM (
      -- 구독료 (결제일 기준)
      SELECT 
        COALESCE(SUM(cs.actual_paid_amount), 0) AS subscription_revenue,
        0 AS usage_revenue
      FROM company_subscriptions cs
      JOIN companies c ON c.id = cs.company_id
      CROSS JOIN month_range mr
      WHERE c.grade <> 'free'
        AND DATE(cs.start_date AT TIME ZONE 'Asia/Seoul') >= mr.month_start
        AND DATE(cs.start_date AT TIME ZONE 'Asia/Seoul') <= mr.month_end
      
      UNION ALL
      
      -- 사용료 (유효재생 기준) - 차감
      SELECT 
        0 AS subscription_revenue,
        COALESCE(SUM(
          CASE 
            WHEN mp.use_case = '0' OR mp.use_case = '1' THEN m.price_per_play::numeric
            WHEN mp.use_case = '2' AND m.inst = false THEN m.lyrics_price::numeric
            ELSE 0
          END
        ), 0) AS usage_revenue
      FROM music_plays mp
      JOIN musics m ON m.id = mp.music_id
      CROSS JOIN month_range mr
      WHERE mp.is_valid_play = true
        AND mp.created_at >= mr.month_start
        AND mp.created_at <= mr.month_end
    ) revenue_data
  `
}

export function buildRewardsFilledStatsQuery(yearMonth: string) {
  const cte = buildMonthRangeCTE(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]))
  
  return sql`
    ${cte}
    , plays AS (
      SELECT 
        mp.music_id,
        COUNT(*) FILTER (WHERE mp.is_valid_play = true) AS valid_plays,
        COALESCE(SUM(CASE WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN mp.reward_amount::numeric ELSE 0 END), 0) AS earned,
        COUNT(*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code IN ('2', '3')) AS limit_exhausted_plays
      FROM music_plays mp, month_range mr
      WHERE mp.created_at >= mr.month_start AND mp.created_at <= mr.month_end
      GROUP BY mp.music_id
    )
    SELECT
      COUNT(*) FILTER (WHERE mmr.total_reward_count > 0)::bigint AS eligible,
      COUNT(*) FILTER (
        WHERE mmr.total_reward_count > 0 AND COALESCE(p.limit_exhausted_plays, 0) > 0
      )::bigint AS filled
    FROM monthly_music_rewards mmr
    LEFT JOIN plays p ON p.music_id = mmr.music_id
    WHERE mmr.year_month = ${yearMonth}
  `
}

export function buildRealtimeApiStatusQuery(limit: number) {
  return sql`
    SELECT 
      mp.id,
      mp.music_id,
      mp.created_at,
      CASE WHEN mp.is_valid_play THEN 'success' ELSE 'error' END AS status,
      CASE 
        WHEN mp.use_case = '0' THEN '/api/music/play'
        WHEN mp.use_case = '1' THEN '/api/music/play'
        WHEN mp.use_case = '2' THEN '/api/lyrics/get'
        ELSE '/api/unknown'
      END AS endpoint,
      CASE 
        WHEN mp.use_case = '0' THEN '음원 호출'
        WHEN mp.use_case = '1' THEN '음원 호출'
        WHEN mp.use_case = '2' THEN '가사 호출'
        ELSE '알 수 없음'
      END AS call_type,
      CASE 
        WHEN mp.is_valid_play AND mp.reward_code = '1' THEN '리워드 발생'
        WHEN mp.is_valid_play AND mp.reward_code != '1' THEN '유효재생 (리워드 없음)'
        ELSE '무효재생'
      END AS validity,
      c.name AS company,
      m.title AS music_title
    FROM music_plays mp
    LEFT JOIN companies c ON c.id = mp.using_company_id
    LEFT JOIN musics m ON m.id = mp.music_id
    WHERE mp.created_at >= NOW() - INTERVAL '5 minutes'
    ORDER BY mp.created_at DESC
    LIMIT ${limit}
  `
}

export function buildRealtimeApiCallsQuery(limit: number) {
  return sql`
    SELECT 
      mp.created_at,
      CASE WHEN mp.is_valid_play THEN 'success' ELSE 'error' END AS status,
      CASE 
        WHEN mp.use_case = '0' THEN '/api/music/play'
        WHEN mp.use_case = '1' THEN '/api/music/play'
        WHEN mp.use_case = '2' THEN '/api/lyrics/get'
        ELSE '/api/unknown'
      END AS endpoint,
      CASE 
        WHEN mp.use_case = '0' THEN '음원 호출'
        WHEN mp.use_case = '1' THEN '음원 호출'
        WHEN mp.use_case = '2' THEN '가사 호출'
        ELSE '알 수 없음'
      END AS call_type,
      CASE 
        WHEN mp.is_valid_play AND mp.reward_code = '1' THEN '리워드 발생'
        WHEN mp.is_valid_play AND mp.reward_code != '1' THEN '유효재생 (리워드 없음)'
        ELSE '무효재생'
      END AS validity,
      c.name AS company,
      m.title AS music_title
    FROM music_plays mp
    LEFT JOIN companies c ON c.id = mp.using_company_id
    LEFT JOIN musics m ON m.id = mp.music_id
    WHERE mp.created_at >= NOW() - INTERVAL '5 minutes'
    ORDER BY mp.created_at DESC
    LIMIT ${limit}
  `
}

export function buildCategoryTop5Query(year: number, month: number, timezone: string, limit: number) {
  const cte = buildMonthRangeCTE(year, month)
  
  return sql`
    ${cte}
    SELECT 
      mc.name AS category,
      COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') AS valid_plays,
      ROW_NUMBER() OVER (ORDER BY COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') DESC) AS rank
    FROM music_categories mc
    LEFT JOIN musics m ON m.category_id = mc.id
    LEFT JOIN music_plays mp ON mp.music_id = m.id
      AND mp.created_at >= (SELECT month_start FROM month_range)
      AND mp.created_at <= (SELECT month_end FROM month_range)
    GROUP BY mc.id, mc.name
    HAVING COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') > 0
    ORDER BY valid_plays DESC
    LIMIT ${limit}
  `
}

export function buildRealtimeTopTracksQuery(limit: number) {
  return sql`
    SELECT 
      m.id,
      m.title,
      COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') AS valid_plays,
      COUNT(mp.*) AS total_plays,
      CASE 
        WHEN COUNT(mp.*) > 0 THEN 
          ROUND((COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1')::numeric / COUNT(mp.*)) * 100, 2)
        ELSE 0 
      END AS valid_rate,
      ROW_NUMBER() OVER (ORDER BY COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') DESC) AS rank
    FROM musics m
    LEFT JOIN music_plays mp ON mp.music_id = m.id
      AND mp.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY m.id, m.title
    HAVING COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') > 0
    ORDER BY valid_plays DESC
    LIMIT ${limit}
  `
}

export function buildRealtimeTransactionsQuery(limit: number) {
  return sql`
    SELECT 
      to_char(created_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS') AS timestamp,
      'success' AS status,
      '0/0' AS processed_count,
      '0.000 ETH' AS gas_fee,
      '0x0000...0000' AS hash
    FROM music_plays
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
}