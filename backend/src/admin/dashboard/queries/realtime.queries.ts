import { sql } from 'drizzle-orm'

export function buildRecentApiCallsQuery() {
  return sql`
    SELECT 
      mp.id,
      mp.music_id,
      mp.created_at,
      CASE 
        WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN 'success'
        ELSE 'error'
      END as status,
      CASE 
        WHEN mp.use_case IN ('0', '1') THEN '/api/music/play'
        WHEN mp.use_case = '2' THEN '/api/lyrics/get'
        ELSE '/api/unknown'
      END as endpoint,
      CASE 
        WHEN mp.use_case IN ('0', '1') THEN '음원 호출'
        WHEN mp.use_case = '2' THEN '가사 호출'
        ELSE '알 수 없음'
      END as call_type,
      CASE 
        WHEN mp.is_valid_play = true AND mp.reward_code = '1' THEN '리워드 발생'
        WHEN mp.is_valid_play = true AND mp.reward_code != '1' THEN '유효재생 (리워드 없음)'
        ELSE '무효재생'
      END as validity,
      c.name as company,
      m.title as music_title
    FROM music_plays mp
    LEFT JOIN companies c ON c.id = mp.using_company_id
    LEFT JOIN musics m ON m.id = mp.music_id
    WHERE mp.created_at >= NOW() - INTERVAL '5 minutes'
    ORDER BY mp.created_at DESC
    LIMIT 50
  `
}

export function buildTopTracksQuery() {
  return sql`
    SELECT 
      m.id,
      m.title,
      COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') as valid_plays,
      ROW_NUMBER() OVER (ORDER BY COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') DESC) as rank
    FROM musics m
    LEFT JOIN music_plays mp ON mp.music_id = m.id
      AND mp.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY m.id, m.title
    HAVING COUNT(mp.*) FILTER (WHERE mp.is_valid_play = true AND mp.reward_code = '1') > 0
    ORDER BY valid_plays DESC
    LIMIT 10
  `
}
