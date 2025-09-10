import { SQL, sql } from 'drizzle-orm'

export type MusicRewardsSortKey = 'music_id' | 'title' | 'artist' | 'category' | 'grade' | 'validPlays' | 'earned' | 'companiesUsing' | 'lastUsedAt'

export function buildMusicRewardsOrderSql(sortBy: string, order: 'asc' | 'desc'): SQL {
  const dir = order === 'desc' ? sql`DESC` : sql`ASC`
  switch (sortBy) {
    case 'music_id': return sql`m.id ${dir}`
    case 'title': return sql`m.title ${dir}`
    case 'artist': return sql`m.artist ${dir}`
    case 'category': return sql`mc.name ${dir}`
    case 'grade': return sql`m.grade_required ${dir}`
    case 'musicType': return sql`m.inst ${dir}`
    case 'monthlyLimit': return sql`mmr.total_reward_count ${dir} NULLS LAST`
    case 'rewardPerPlay': return sql`mmr.reward_per_play ${dir} NULLS LAST`
    case 'usageRate':
      return sql`
        CASE 
          WHEN mmr.total_reward_count IS NULL OR mmr.total_reward_count <= 0 THEN NULL
          WHEN mmr.remaining_reward_count IS NOT NULL AND (mmr.total_reward_count - mmr.remaining_reward_count) > 0 THEN 
            ((mmr.total_reward_count - mmr.remaining_reward_count)::numeric / NULLIF(mmr.total_reward_count, 0)::numeric) * 100
          WHEN mmr.reward_per_play IS NOT NULL AND mmr.reward_per_play > 0 AND COALESCE(p.earned,0) > 0 THEN
            (FLOOR(COALESCE(p.earned, 0) / NULLIF(mmr.reward_per_play, 0))::numeric / NULLIF(mmr.total_reward_count, 0)::numeric) * 100
          ELSE 
            (LEAST(COALESCE(p.valid_plays, 0), mmr.total_reward_count)::numeric / NULLIF(mmr.total_reward_count, 0)::numeric) * 100
        END ${dir} NULLS LAST
      `
    case 'validPlays': return sql`p.valid_plays ${dir}`
    case 'earned': return sql`p.earned ${dir}`
    case 'companiesUsing': return sql`p.companies_using ${dir}`
    case 'lastUsedAt': return sql`p.last_used_at ${dir} NULLS LAST`
    default: return sql`p.earned DESC, p.valid_plays DESC`
  }
}

export function buildMusicRewardsSummaryQuery(params: {
  year: number
  month: number
  search?: string
  categoryId?: number
  grade?: number
  musicType?: boolean // true: Inst, false: 일반
  offset: number
  limit: number
  orderBySql: SQL
}) {
  const { year, month, search, categoryId, grade, musicType, offset, limit, orderBySql } = params

  const ym = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`

  const base = sql`
WITH month_range AS (
  SELECT
    make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') AS month_start,
    (make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second' AS month_end
),
plays AS (
  SELECT
    mp.music_id,
    COUNT(*) FILTER (WHERE mp.is_valid_play = true) AS valid_plays,
    COALESCE(SUM(CASE WHEN mp.is_valid_play = true THEN mp.reward_amount::numeric ELSE 0 END), 0) AS earned,
    COUNT(DISTINCT CASE WHEN mp.is_valid_play = true THEN mp.using_company_id END) AS companies_using,
    MAX(mp.created_at) AS last_used_at
  FROM music_plays mp, month_range mr
  WHERE mp.created_at >= mr.month_start AND mp.created_at <= mr.month_end
  GROUP BY mp.music_id
)
SELECT
  m.id AS music_id,
  m.title,
  m.artist,
  mc.name AS category,
  m.grade_required AS grade,
  m.inst AS music_type,
  COALESCE(p.valid_plays, 0) AS valid_plays,
  COALESCE(p.earned, 0) AS earned,
  COALESCE(p.companies_using, 0) AS companies_using,
  to_char(p.last_used_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS last_used_at,
  mmr.total_reward_count AS monthly_limit,
  mmr.remaining_reward_count AS monthly_remaining,
  mmr.reward_per_play AS reward_per_play
FROM musics m
LEFT JOIN plays p ON p.music_id = m.id
LEFT JOIN music_categories mc ON mc.id = m.category_id
LEFT JOIN monthly_music_rewards mmr ON mmr.music_id = m.id AND mmr.year_month = ${ym}
WHERE 1=1
${search ? sql` AND (m.title ILIKE '%' || ${search} || '%' OR m.artist ILIKE '%' || ${search} || '%')` : sql``}
${typeof categoryId === 'number' && Number.isFinite(categoryId) ? sql` AND m.category_id = ${categoryId}` : sql``}
${typeof grade === 'number' ? sql` AND m.grade_required = ${grade}` : sql``}
${typeof musicType === 'boolean' ? (musicType ? sql` AND m.inst = true` : sql` AND m.inst = false`) : sql``}
ORDER BY ${orderBySql}
OFFSET ${offset} LIMIT ${limit}
  `

  return base
}

export function buildMusicRewardsSummaryCountQuery(params: {
  year: number
  month: number
  search?: string
  categoryId?: number
  grade?: number
  musicType?: boolean
}) {
  const { year, month, search, categoryId, grade, musicType } = params
  const q = sql`
WITH month_range AS (
  SELECT
    make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') AS month_start,
    (make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second' AS month_end
)
SELECT COUNT(*) AS total
FROM musics m
LEFT JOIN music_categories mc ON mc.id = m.category_id
WHERE 1=1
${search ? sql` AND (m.title ILIKE '%' || ${search} || '%' OR m.artist ILIKE '%' || ${search} || '%')` : sql``}
${typeof categoryId === 'number' && Number.isFinite(categoryId) ? sql` AND m.category_id = ${categoryId}` : sql``}
${typeof grade === 'number' ? sql` AND m.grade_required = ${grade}` : sql``}
${typeof musicType === 'boolean' ? (musicType ? sql` AND m.inst = true` : sql` AND m.inst = false`) : sql``}
  `
  return q
} 