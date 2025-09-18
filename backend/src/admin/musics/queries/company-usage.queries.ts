import { SQL, sql } from 'drizzle-orm'

export function buildMusicCompanyUsageListQuery(params: {
  musicId: number
  year: number
  month: number
  search?: string
  limit: number
  offset: number
}): SQL {
  const { musicId, year, month, search, limit, offset } = params
  return sql`
WITH month_range AS (
  SELECT
    make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') AS month_start,
    (make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second' AS month_end
)
SELECT 
  mp.using_company_id AS company_id,
  COALESCE(c.name, 'Unknown') AS company_name,
  COALESCE(c.grade, 'free') AS grade,
  COUNT(*) FILTER (WHERE mp.is_valid_play = true) AS monthly_plays,
  COALESCE(SUM(CASE WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN mp.reward_amount::numeric ELSE 0 END), 0) AS monthly_earned
FROM music_plays mp
JOIN companies c ON c.id = mp.using_company_id
JOIN month_range mr ON TRUE
WHERE mp.music_id = ${musicId}
  AND mp.created_at >= mr.month_start AND mp.created_at <= mr.month_end
  ${search ? sql`AND (c.name ILIKE '%' || ${search} || '%' OR c.id::text ILIKE '%' || ${search} || '%')` : sql``}
GROUP BY mp.using_company_id, c.name, c.grade
ORDER BY monthly_earned DESC, monthly_plays DESC
LIMIT ${limit} OFFSET ${offset}
  `
}

export function buildMusicCompanyUsageCountQuery(params: {
  musicId: number
  year: number
  month: number
  search?: string
}): SQL {
  const { musicId, year, month, search } = params
  return sql`
WITH month_range AS (
  SELECT
    make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') AS month_start,
    (make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second' AS month_end
)
SELECT COUNT(*) AS total
FROM (
  SELECT mp.using_company_id
  FROM music_plays mp
  JOIN month_range mr ON TRUE
  LEFT JOIN companies c ON c.id = mp.using_company_id
  WHERE mp.music_id = ${musicId}
    AND mp.created_at >= mr.month_start AND mp.created_at <= mr.month_end
    ${search ? sql`AND (c.name ILIKE '%' || ${search} || '%' OR c.id::text ILIKE '%' || ${search} || '%')` : sql``}
  GROUP BY mp.using_company_id
) t
  `
} 