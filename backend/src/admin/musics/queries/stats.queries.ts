import { sql } from 'drizzle-orm'
import { buildMonthRangeCTE } from '../../../common/utils/date.util'

export const buildCategoryTop5Query = (ymYear: number, ymMonth: number, tz: string, limit: number = 5) => sql`
  WITH month_range AS (
    SELECT 
      make_timestamptz(${ymYear}, ${ymMonth}, 1, 0, 0, 0, ${tz}) AS month_start,
      (make_timestamptz(${ymYear}, ${ymMonth}, 1, 0, 0, 0, ${tz}) + interval '1 month') - interval '1 second' AS month_end
  ),
  category_plays AS (
    SELECT 
      COALESCE(mc.name, '미분류') AS category,
      COUNT(*) FILTER (WHERE mp.is_valid_play = true) AS valid_plays
    FROM music_plays mp
    JOIN musics m ON m.id = mp.music_id
    LEFT JOIN music_categories mc ON mc.id = m.category_id
    , month_range mr
    WHERE mp.created_at >= mr.month_start 
      AND mp.created_at <= mr.month_end
    GROUP BY mc.name
  ),
  ranked AS (
    SELECT 
      category,
      valid_plays,
      ROW_NUMBER() OVER (ORDER BY valid_plays DESC) AS rank
    FROM category_plays
  )
  SELECT category, valid_plays, rank
  FROM ranked
  WHERE rank <= ${limit}
  ORDER BY rank ASC
`

export const buildRealtimeApiStatusQuery = (limit: number = 5) => sql`
  WITH recent_plays AS (
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
        WHEN mp.is_valid_play THEN '유효재생'
        ELSE '무효재생'
      END AS validity,
      c.name AS company
    FROM music_plays mp
    JOIN companies c ON c.id = mp.using_company_id
    ORDER BY mp.created_at DESC
    LIMIT ${limit * 3}
  )
  SELECT 
    status,
    endpoint,
    call_type,
    validity,
    company,
    to_char(created_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS') AS timestamp
  FROM recent_plays
  ORDER BY created_at DESC
  LIMIT ${limit}
`

export const buildRealtimeTopTracksQuery = (limit: number = 10) => sql`
  WITH last_24h_plays AS (
    SELECT 
      m.id,
      m.title,
      COUNT(*) FILTER (WHERE mp.is_valid_play = true) AS valid_plays_24h,
      COUNT(*) AS total_plays_24h
    FROM music_plays mp
    JOIN musics m ON m.id = mp.music_id
    WHERE mp.created_at >= NOW() - interval '24 hours'
    GROUP BY m.id, m.title
    HAVING COUNT(*) FILTER (WHERE mp.is_valid_play = true) > 0
  )
  SELECT 
    ROW_NUMBER() OVER (ORDER BY valid_plays_24h DESC) AS rank,
    title,
    valid_plays_24h AS valid_plays,
    total_plays_24h AS total_plays,
    CASE 
      WHEN total_plays_24h > 0 THEN ROUND((valid_plays_24h::numeric / total_plays_24h::numeric) * 100)
      ELSE 0
    END AS valid_rate
  FROM last_24h_plays
  ORDER BY valid_plays_24h DESC
  LIMIT ${limit}
`

export const buildRealtimeTransactionsQuery = (limit: number = 3) => sql`
  WITH mock_tx AS (
    SELECT 
      NOW() - (random() * interval '1 hour') AS timestamp,
      CASE 
        WHEN random() < 0.8 THEN 'success'
        WHEN random() < 0.9 THEN 'pending'
        ELSE 'failed'
      END AS status,
      (20 + floor(random() * 15))::text || '/' || (25 + floor(random() * 10))::text AS processed_count,
      '0.00' || (3 + floor(random() * 3))::text || ' ETH' AS gas_fee,
      '0x' || substr(md5(random()::text), 1, 8) || '...' || substr(md5(random()::text), 1, 4) AS hash
    FROM generate_series(1, ${limit})
  )
  SELECT 
    to_char(timestamp AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS') AS timestamp,
    status,
    processed_count,
    gas_fee,
    hash
  FROM mock_tx
  ORDER BY timestamp DESC
`
