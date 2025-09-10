import { sql } from 'drizzle-orm'
import { buildDayRangeCTE } from '../../../common/utils/date.util'

export const buildRenewalStatsQuery = (ymYear: number, ymMonth: number, tz: string) => sql`
  WITH anchor AS (
    SELECT make_timestamptz(${ymYear}, ${ymMonth}, 1, 0, 0, 0, ${tz}) AS m
  ),
  cur AS (
    SELECT cs.company_id
    FROM company_subscriptions cs, anchor a
    WHERE cs.start_date < (a.m + interval '1 month')
      AND cs.end_date   >= a.m
    GROUP BY cs.company_id
  ),
  prev AS (
    SELECT cs.company_id
    FROM company_subscriptions cs, anchor a
    WHERE cs.start_date < ((a.m - interval '1 month') + interval '1 month')
      AND cs.end_date   >= (a.m - interval '1 month')
    GROUP BY cs.company_id
  )
  SELECT 
    (SELECT COUNT(*) FROM prev) AS prev_active,
    (SELECT COUNT(*) FROM cur) AS curr_active,
    (SELECT COUNT(*) FROM prev p INNER JOIN cur c ON c.company_id = p.company_id) AS retained,
    (SELECT COUNT(*) FROM prev p LEFT JOIN cur c ON c.company_id = p.company_id WHERE c.company_id IS NULL) AS churned,
    (SELECT COUNT(*) FROM cur c LEFT JOIN prev p ON p.company_id = c.company_id WHERE p.company_id IS NULL) AS reactivated
`

export const buildHourlyValidPlaysQuery = (y: number, m: number, d: number, tz: string) => {
  const dayCte = buildDayRangeCTE(y, m, d)
  return sql`
    ${dayCte}
    , hours AS (
      SELECT generate_series(0,23) AS h
    ),
    today AS (
      SELECT 
        EXTRACT(HOUR FROM (mp.created_at AT TIME ZONE ${tz}))::int AS h,
        c.grade,
        COUNT(*) AS total_cnt,
        COUNT(*) FILTER (WHERE mp.is_valid_play = true) AS valid_cnt,
        COUNT(*) FILTER (WHERE mp.use_case = '2') AS lyrics_cnt
      FROM music_plays mp
      JOIN companies c ON c.id = mp.using_company_id
      WHERE mp.created_at >= (SELECT day_start FROM day_range)
        AND mp.created_at <  (SELECT day_end FROM day_range)
      GROUP BY 1, c.grade
    ),
    today_pivot AS (
      SELECT 
        h.h,
        COALESCE(SUM(t.total_cnt) FILTER (WHERE t.grade = 'free'), 0) AS free_total,
        COALESCE(SUM(t.valid_cnt) FILTER (WHERE t.grade = 'free'), 0) AS free_valid,
        COALESCE(SUM(t.lyrics_cnt) FILTER (WHERE t.grade = 'free'), 0) AS free_lyrics,
        COALESCE(SUM(t.total_cnt) FILTER (WHERE t.grade = 'standard'), 0) AS standard_total,
        COALESCE(SUM(t.valid_cnt) FILTER (WHERE t.grade = 'standard'), 0) AS standard_valid,
        COALESCE(SUM(t.lyrics_cnt) FILTER (WHERE t.grade = 'standard'), 0) AS standard_lyrics,
        COALESCE(SUM(t.total_cnt) FILTER (WHERE t.grade = 'business'), 0) AS business_total,
        COALESCE(SUM(t.valid_cnt) FILTER (WHERE t.grade = 'business'), 0) AS business_valid,
        COALESCE(SUM(t.lyrics_cnt) FILTER (WHERE t.grade = 'business'), 0) AS business_lyrics
      FROM hours h
      LEFT JOIN today t ON t.h = h.h
      GROUP BY h.h
    ),
    yday AS (
      SELECT 
        EXTRACT(HOUR FROM (mp.created_at AT TIME ZONE ${tz}))::int AS h,
        c.grade,
        COUNT(*) AS total_cnt,
        COUNT(*) FILTER (WHERE mp.is_valid_play = true) AS valid_cnt,
        COUNT(*) FILTER (WHERE mp.use_case = '2') AS lyrics_cnt
      FROM music_plays mp
      JOIN companies c ON c.id = mp.using_company_id
      WHERE mp.created_at >= ((SELECT day_start FROM day_range) - interval '1 day')
        AND mp.created_at <  (SELECT day_start FROM day_range)
      GROUP BY 1, c.grade
    ),
    yday_pivot AS (
      SELECT 
        h.h,
        COALESCE(SUM(t.total_cnt) FILTER (WHERE t.grade = 'free'), 0) AS free_total,
        COALESCE(SUM(t.valid_cnt) FILTER (WHERE t.grade = 'free'), 0) AS free_valid,
        COALESCE(SUM(t.lyrics_cnt) FILTER (WHERE t.grade = 'free'), 0) AS free_lyrics,
        COALESCE(SUM(t.total_cnt) FILTER (WHERE t.grade = 'standard'), 0) AS standard_total,
        COALESCE(SUM(t.valid_cnt) FILTER (WHERE t.grade = 'standard'), 0) AS standard_valid,
        COALESCE(SUM(t.lyrics_cnt) FILTER (WHERE t.grade = 'standard'), 0) AS standard_lyrics,
        COALESCE(SUM(t.total_cnt) FILTER (WHERE t.grade = 'business'), 0) AS business_total,
        COALESCE(SUM(t.valid_cnt) FILTER (WHERE t.grade = 'business'), 0) AS business_valid,
        COALESCE(SUM(t.lyrics_cnt) FILTER (WHERE t.grade = 'business'), 0) AS business_lyrics
      FROM hours h
      LEFT JOIN yday t ON t.h = h.h
      GROUP BY h.h
    )
    SELECT 
      tp.h,
      tp.free_total,
      tp.free_valid,
      tp.free_lyrics,
      tp.standard_total,
      tp.standard_valid,
      tp.standard_lyrics,
      tp.business_total,
      tp.business_valid,
      tp.business_lyrics,
      ROUND(((yp.free_total + yp.standard_total + yp.business_total)::numeric / 3))::int AS prev_avg
    FROM today_pivot tp
    JOIN yday_pivot yp ON yp.h = tp.h
    ORDER BY tp.h ASC
  `
}

export const buildTierDistributionQuery = (ymYear: number, ymMonth: number, tz: string) => sql`
  WITH month_range AS (
    SELECT 
      make_timestamptz(${ymYear}, ${ymMonth}, 1, 0, 0, 0, ${tz}) AS month_start,
      (make_timestamptz(${ymYear}, ${ymMonth}, 1, 0, 0, 0, ${tz}) + interval '1 month') - interval '1 second' AS month_end
  ),
  active_companies AS (
    SELECT DISTINCT c.id, c.grade
    FROM companies c
    WHERE c.created_at <= (SELECT month_end FROM month_range)
  )
  SELECT 
    COUNT(*) FILTER (WHERE grade = 'free') AS free,
    COUNT(*) FILTER (WHERE grade = 'standard') AS standard,
    COUNT(*) FILTER (WHERE grade = 'business') AS business,
    COUNT(*) AS total
  FROM active_companies
`

export const buildRevenueCalendarQuery = (ymYear: number, ymMonth: number, tz: string) => sql`
  WITH sub_base AS (
    SELECT 
      DATE(cs.start_date AT TIME ZONE ${tz}) AS kst_date,
      cs.actual_paid_amount
    FROM company_subscriptions cs
    JOIN companies c ON c.id = cs.company_id
    WHERE c.grade <> 'free'
      AND EXTRACT(YEAR FROM cs.start_date AT TIME ZONE ${tz}) = ${ymYear}
      AND EXTRACT(MONTH FROM cs.start_date AT TIME ZONE ${tz}) = ${ymMonth}
  ),
  daily_subscription AS (
    SELECT kst_date AS date, SUM(actual_paid_amount) AS subscription_revenue
    FROM sub_base
    GROUP BY kst_date
  ),
  usage_base AS (
    SELECT 
      DATE(mp.created_at AT TIME ZONE ${tz}) AS kst_date,
      CASE 
        WHEN mp.use_case = '0' THEN COALESCE(m.price_per_play::numeric, 0)
        WHEN mp.use_case = '1' THEN COALESCE(m.price_per_play::numeric, 0)
        WHEN mp.use_case = '2' AND m.inst = false THEN COALESCE(m.lyrics_price::numeric, 0)
        ELSE 0
      END AS amount
    FROM music_plays mp
    JOIN musics m ON m.id = mp.music_id
    WHERE EXTRACT(YEAR FROM mp.created_at AT TIME ZONE ${tz}) = ${ymYear}
      AND EXTRACT(MONTH FROM mp.created_at AT TIME ZONE ${tz}) = ${ymMonth}
      AND mp.is_valid_play = true
  ),
  daily_usage AS (
    SELECT kst_date AS date, SUM(amount) AS usage_revenue
    FROM usage_base
    GROUP BY kst_date
  ),
  all_days AS (
    SELECT generate_series(
      make_date(${ymYear}, ${ymMonth}, 1),
      (make_date(${ymYear}, ${ymMonth}, 1) + interval '1 month' - interval '1 day')::date,
      interval '1 day'
    )::date AS date
  )
  SELECT 
    to_char(ad.date, 'YYYY-MM-DD') AS date,
    COALESCE(ds.subscription_revenue, 0) AS subscription_revenue,
    COALESCE(du.usage_revenue, 0) AS usage_revenue,
    COALESCE(ds.subscription_revenue, 0) + COALESCE(du.usage_revenue, 0) AS total_revenue
  FROM all_days ad
  LEFT JOIN daily_subscription ds ON ds.date = ad.date
  LEFT JOIN daily_usage du ON du.date = ad.date
  ORDER BY ad.date
`

export const buildRevenueTrendsQuery = (startYear: number, startMonth: number, months: number) => sql`
  WITH month_series AS (
    SELECT 
      EXTRACT(YEAR FROM gs)::int AS year,
      EXTRACT(MONTH FROM gs)::int AS month_num
    FROM generate_series(
      make_date(${startYear}, ${startMonth}, 1)::date,
      (make_date(${startYear}, ${startMonth}, 1) + ((${months})::int - 1) * interval '1 month')::date,
      interval '1 month'
    ) AS gs
  ),
  subscription_revenue AS (
    SELECT 
      EXTRACT(YEAR FROM cs.created_at) AS year,
      EXTRACT(MONTH FROM cs.created_at) AS month,
      c.grade,
      SUM(cs.actual_paid_amount) AS revenue
    FROM company_subscriptions cs
    JOIN companies c ON c.id = cs.company_id
    GROUP BY EXTRACT(YEAR FROM cs.created_at), EXTRACT(MONTH FROM cs.created_at), c.grade
  ),
  usage_revenue AS (
    SELECT 
      EXTRACT(YEAR FROM mp.created_at) AS year,
      EXTRACT(MONTH FROM mp.created_at) AS month,
      CASE 
        WHEN mp.use_case = '0' THEN 'general'
        WHEN mp.use_case = '1' THEN 'general'
        WHEN mp.use_case = '2' THEN 'lyrics'
        ELSE 'instrumental'
      END AS usage_type,
      SUM(
        CASE 
          WHEN mp.use_case = '0' THEN COALESCE(m.price_per_play::numeric, 0)
          WHEN mp.use_case = '1' THEN COALESCE(m.price_per_play::numeric, 0)
          WHEN mp.use_case = '2' THEN COALESCE(m.lyrics_price::numeric, 0)
          ELSE 0
        END
      ) AS revenue
    FROM music_plays mp
    JOIN musics m ON m.id = mp.music_id
    WHERE mp.is_valid_play = true
    GROUP BY EXTRACT(YEAR FROM mp.created_at), EXTRACT(MONTH FROM mp.created_at), usage_type
  )
  SELECT 
    ms.month_num AS month,
    ms.year,
    COALESCE(SUM(sr.revenue) FILTER (WHERE sr.grade = 'standard'), 0) AS standard_subscription,
    COALESCE(SUM(sr.revenue) FILTER (WHERE sr.grade = 'business'), 0) AS business_subscription,
    COALESCE(SUM(ur.revenue) FILTER (WHERE ur.usage_type = 'general'), 0) AS general_usage,
    COALESCE(SUM(ur.revenue) FILTER (WHERE ur.usage_type = 'lyrics'), 0) AS lyrics_usage,
    COALESCE(SUM(ur.revenue) FILTER (WHERE ur.usage_type = 'instrumental'), 0) AS instrumental_usage
  FROM month_series ms
  LEFT JOIN subscription_revenue sr ON sr.month = ms.month_num AND sr.year = ms.year
  LEFT JOIN usage_revenue ur ON ur.month = ms.month_num AND ur.year = ms.year
  GROUP BY ms.month_num, ms.year
  ORDER BY ms.year, ms.month_num
`

export const buildRevenueCompaniesQuery = (ymYear: number, ymMonth: number, tz: string, grade: string, limit: number) => sql`
  WITH month_range AS (
    SELECT 
      make_timestamptz(${ymYear}, ${ymMonth}, 1, 0, 0, 0, ${tz}) AS month_start,
      (make_timestamptz(${ymYear}, ${ymMonth}, 1, 0, 0, 0, ${tz}) + interval '1 month') - interval '1 second' AS month_end
  ),
  company_revenue AS (
    SELECT 
      c.id AS company_id,
      c.name AS company_name,
      c.grade,
      COALESCE(SUM(cs.actual_paid_amount), 0) AS subscription_revenue,
      COALESCE(SUM(
        CASE 
          WHEN mp.use_case = '0' THEN COALESCE(m.price_per_play::numeric, 0)
          WHEN mp.use_case = '1' THEN COALESCE(m.price_per_play::numeric, 0)
          WHEN mp.use_case = '2' THEN COALESCE(m.lyrics_price::numeric, 0)
          ELSE 0
        END
      ), 0) AS usage_revenue
    FROM companies c
    LEFT JOIN company_subscriptions cs ON cs.company_id = c.id
      AND cs.created_at >= (SELECT month_start FROM month_range)
      AND cs.created_at <= (SELECT month_end FROM month_range)
    LEFT JOIN music_plays mp ON mp.using_company_id = c.id
      AND mp.created_at >= (SELECT month_start FROM month_range)
      AND mp.created_at <= (SELECT month_end FROM month_range)
      AND mp.is_valid_play = true
    LEFT JOIN musics m ON m.id = mp.music_id
    WHERE c.grade = ${grade}
    GROUP BY c.id, c.name, c.grade
    HAVING COALESCE(SUM(cs.actual_paid_amount), 0) + COALESCE(SUM(
      CASE 
        WHEN mp.use_case = '0' THEN COALESCE(m.price_per_play::numeric, 0)
        WHEN mp.use_case = '1' THEN COALESCE(m.price_per_play::numeric, 0)
        WHEN mp.use_case = '2' THEN COALESCE(m.lyrics_price::numeric, 0)
        ELSE 0
      END
    ), 0) > 0
  ),
  ranked_companies AS (
    SELECT 
      company_id,
      company_name,
      grade,
      subscription_revenue,
      usage_revenue,
      subscription_revenue + usage_revenue AS total_revenue,
      ROW_NUMBER() OVER (ORDER BY subscription_revenue + usage_revenue DESC) AS rank
    FROM company_revenue
  )
  SELECT 
    rank,
    company_id,
    company_name,
    grade,
    subscription_revenue,
    usage_revenue,
    total_revenue,
    ROUND((total_revenue::numeric / SUM(total_revenue) OVER ()) * 100, 1) AS percentage
  FROM ranked_companies
  WHERE rank <= ${limit}
  ORDER BY rank
`


// 누적(전체 기간) 구독료만으로 기업 랭킹 산출
export const buildRevenueCompaniesCumulativeQuery = (grade: string, limit: number) => sql`
  WITH company_revenue AS (
    SELECT 
      c.id AS company_id,
      c.name AS company_name,
      c.grade,
      COALESCE(SUM(cs.actual_paid_amount), 0) AS subscription_revenue
    FROM companies c
    LEFT JOIN company_subscriptions cs ON cs.company_id = c.id
    WHERE c.grade = ${grade}
    GROUP BY c.id, c.name, c.grade
    HAVING COALESCE(SUM(cs.actual_paid_amount), 0) > 0
  ),
  ranked_companies AS (
    SELECT 
      company_id,
      company_name,
      grade,
      subscription_revenue,
      subscription_revenue AS total_revenue,
      ROW_NUMBER() OVER (ORDER BY subscription_revenue DESC) AS rank
    FROM company_revenue
  )
  SELECT 
    rank,
    company_id,
    company_name,
    grade,
    subscription_revenue,
    0::numeric AS usage_revenue,
    total_revenue,
    ROUND((total_revenue::numeric / NULLIF(SUM(total_revenue) OVER (), 0)) * 100, 1) AS percentage
  FROM ranked_companies
  WHERE rank <= ${limit}
  ORDER BY rank
`


