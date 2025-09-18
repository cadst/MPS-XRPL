export function buildApiStatsQuery(period: '24h' | '7d' | '30d') {
  const timeCondition = getTimeCondition(period)
  
  return `
    WITH api_stats AS (
      SELECT 
        COUNT(CASE WHEN mp.use_case IN ('0', '1') THEN 1 END) as music_calls,
        COUNT(CASE WHEN mp.use_case = '2' THEN 1 END) as lyrics_calls,
        COUNT(*) as total_calls
      FROM music_plays mp
      WHERE mp.created_at >= ${timeCondition}
        AND mp.is_valid_play = true
    ),
    prev_period_stats AS (
      SELECT 
        COUNT(CASE WHEN mp.use_case IN ('0', '1') THEN 1 END) as prev_music_calls,
        COUNT(CASE WHEN mp.use_case = '2' THEN 1 END) as prev_lyrics_calls,
        COUNT(*) as prev_total_calls
      FROM music_plays mp
      WHERE mp.created_at >= ${timeCondition} - INTERVAL '${getInterval(period)}'
        AND mp.created_at < ${timeCondition}
        AND mp.is_valid_play = true
    ),
    active_keys AS (
      SELECT COUNT(DISTINCT c.api_key_hash) as active_api_keys
      FROM companies c
      WHERE c.api_key_hash IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM music_plays mp 
          WHERE mp.using_company_id = c.id 
            AND mp.created_at >= NOW() - INTERVAL '1 month'
        )
    ),
    prev_active_keys AS (
      SELECT COUNT(DISTINCT c.api_key_hash) as prev_active_api_keys
      FROM companies c
      WHERE c.api_key_hash IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM music_plays mp 
          WHERE mp.using_company_id = c.id 
            AND mp.created_at >= NOW() - INTERVAL '2 months'
            AND mp.created_at < NOW() - INTERVAL '1 month'
        )
    )
    SELECT 
      api_stats.*,
      active_keys.active_api_keys,
      CASE 
        WHEN prev_period_stats.prev_music_calls > 0 
        THEN ROUND(((api_stats.music_calls - prev_period_stats.prev_music_calls)::numeric / prev_period_stats.prev_music_calls * 100), 1)
        ELSE 0 
      END as music_calls_change,
      CASE 
        WHEN prev_period_stats.prev_lyrics_calls > 0 
        THEN ROUND(((api_stats.lyrics_calls - prev_period_stats.prev_lyrics_calls)::numeric / prev_period_stats.prev_lyrics_calls * 100), 1)
        ELSE 0 
      END as lyrics_calls_change,
      CASE 
        WHEN prev_period_stats.prev_total_calls > 0 
        THEN ROUND(((api_stats.total_calls - prev_period_stats.prev_total_calls)::numeric / prev_period_stats.prev_total_calls * 100), 1)
        ELSE 0 
      END as total_calls_change,
      (active_keys.active_api_keys - prev_active_keys.prev_active_api_keys) as active_api_keys_change
    FROM api_stats, prev_period_stats, active_keys, prev_active_keys
  `
}

export function buildApiChartQuery(period: '24h' | '7d' | '30d') {
  switch (period) {
    case '24h':
      return `
        SELECT 
          EXTRACT(HOUR FROM mp.created_at) as hour,
          TO_CHAR(mp.created_at, 'HH24시') as label,
          COUNT(*) as total_calls,
          COUNT(CASE WHEN mp.use_case IN ('0', '1') THEN 1 END) as music_calls,
          COUNT(CASE WHEN mp.use_case = '2' THEN 1 END) as lyrics_calls,
          COUNT(CASE WHEN c.grade = 'free' THEN 1 END) as free_calls,
          COUNT(CASE WHEN c.grade = 'standard' THEN 1 END) as standard_calls,
          COUNT(CASE WHEN c.grade = 'business' THEN 1 END) as business_calls
        FROM music_plays mp
        LEFT JOIN companies c ON c.id = mp.using_company_id
        WHERE mp.created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY EXTRACT(HOUR FROM mp.created_at), TO_CHAR(mp.created_at, 'HH24시')
        ORDER BY hour
      `
    case '7d':
      return `
        SELECT 
          EXTRACT(DOW FROM mp.created_at) as dow,
          TO_CHAR(mp.created_at, 'Day') as label,
          COUNT(CASE WHEN mp.use_case IN ('0', '1') THEN 1 END) as music_calls,
          COUNT(CASE WHEN mp.use_case = '2' THEN 1 END) as lyrics_calls
        FROM music_plays mp
        WHERE mp.created_at >= NOW() - INTERVAL '7 days'
          AND mp.is_valid_play = true
        GROUP BY EXTRACT(DOW FROM mp.created_at), TO_CHAR(mp.created_at, 'Day')
        ORDER BY dow
      `
    case '30d':
      return `
        WITH week_series AS (
          SELECT generate_series(
            date_trunc('week', NOW() - INTERVAL '30 days'),
            date_trunc('week', NOW()),
            INTERVAL '1 week'
          ) as week_start
        )
        SELECT 
          ws.week_start,
          TO_CHAR(ws.week_start, 'MM/DD') || '~' || TO_CHAR(ws.week_start + INTERVAL '6 days', 'MM/DD') as label,
          COALESCE(COUNT(CASE WHEN mp.use_case IN ('0', '1') THEN 1 END), 0) as music_calls,
          COALESCE(COUNT(CASE WHEN mp.use_case = '2' THEN 1 END), 0) as lyrics_calls
        FROM week_series ws
        LEFT JOIN music_plays mp ON mp.created_at >= ws.week_start 
          AND mp.created_at < ws.week_start + INTERVAL '1 week'
          AND mp.is_valid_play = true
        GROUP BY ws.week_start
        ORDER BY ws.week_start
      `
  }
}

export function buildApiKeysQuery(dto: { search?: string; sortBy?: string; sortOrder?: string }) {
  const searchCondition = dto.search 
    ? `AND (c.name ILIKE '%${dto.search}%' OR c.api_key_hash ILIKE '%${dto.search}%')`
    : ''
  
  const orderBy = getOrderBy(dto.sortBy || 'usage', dto.sortOrder || 'desc')
  
  return `
    SELECT 
      c.id as company_id,
      c.name as company_name,
      CASE 
        WHEN c.api_key_hash IS NOT NULL 
        THEN 'sk_live_' || SUBSTRING(c.api_key_hash, 1, 8) || '...' || SUBSTRING(c.api_key_hash, -4)
        ELSE NULL
      END as api_key,
      TO_CHAR(c.created_at, 'YYYY.MM.DD') as created_at,
      CASE 
        WHEN latest_usage.latest_used_at IS NOT NULL 
        THEN 
          CASE 
            WHEN EXTRACT(EPOCH FROM (NOW() - latest_usage.latest_used_at))/60 < 1
            THEN '방금 전'
            WHEN EXTRACT(EPOCH FROM (NOW() - latest_usage.latest_used_at))/60 < 60
            THEN ROUND(EXTRACT(EPOCH FROM (NOW() - latest_usage.latest_used_at))/60) || '분 전'
            WHEN EXTRACT(EPOCH FROM (NOW() - latest_usage.latest_used_at))/3600 < 24
            THEN ROUND(EXTRACT(EPOCH FROM (NOW() - latest_usage.latest_used_at))/3600) || '시간 전'
            ELSE ROUND(EXTRACT(EPOCH FROM (NOW() - latest_usage.latest_used_at))/86400) || '일 전'
          END
        ELSE '-'
      END as last_used,
      COALESCE(api_stats.total_calls, 0) as total_calls,
      COALESCE(api_stats.music_calls, 0) as music_calls,
      COALESCE(api_stats.lyrics_calls, 0) as lyrics_calls
    FROM companies c
    LEFT JOIN (
      SELECT 
        mp.using_company_id as company_id,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN mp.use_case IN ('0', '1') THEN 1 END) as music_calls,
        COUNT(CASE WHEN mp.use_case = '2' THEN 1 END) as lyrics_calls
      FROM music_plays mp
      WHERE mp.is_valid_play = true
        AND mp.created_at >= NOW() - INTERVAL '1 month'
      GROUP BY mp.using_company_id
    ) api_stats ON api_stats.company_id = c.id
    LEFT JOIN (
      SELECT 
        using_company_id as company_id,
        MAX(created_at) as latest_used_at
      FROM music_plays
      WHERE is_valid_play = true
      GROUP BY using_company_id
    ) latest_usage ON latest_usage.company_id = c.id
    WHERE c.api_key_hash IS NOT NULL
      ${searchCondition}
    ORDER BY ${orderBy}
    LIMIT 50
  `
}

function getTimeCondition(period: '24h' | '7d' | '30d'): string {
  switch (period) {
    case '24h': return "NOW() - INTERVAL '24 hours'"
    case '7d': return "NOW() - INTERVAL '7 days'"
    case '30d': return "NOW() - INTERVAL '30 days'"
  }
}

function getInterval(period: '24h' | '7d' | '30d'): string {
  switch (period) {
    case '24h': return '24 hours'
    case '7d': return '7 days'
    case '30d': return '30 days'
  }
}

function getOrderBy(sortBy: string, sortOrder: string): string {
  switch (sortBy) {
    case 'usage':
      return `total_calls ${sortOrder.toUpperCase()}`
    case 'recent':
      return `latest_usage.latest_used_at ${sortOrder.toUpperCase()} NULLS LAST`
    case 'created':
      return `c.created_at ${sortOrder.toUpperCase()}`
    default:
      return `total_calls ${sortOrder.toUpperCase()}`
  }
}
