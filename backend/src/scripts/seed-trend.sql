-- =============================================
-- Seed: music_plays & company_musics (KST)
-- How to use:
--   1) 필요 시 아래 설정값을 수정하세요
--   2) 이 파일을 psql/DB 클라이언트에서 실행하세요
-- =============================================

-- 설정값 (필요 시 수정)
-- 대상 회사 / 음원
-- 회사 ID
WITH _config AS (
  SELECT 
    ARRAY[1,2,3]::int[]              AS company_ids,
    ARRAY[18,19,20,21,22,23,24,25]::int[] AS music_ids,
    12::int                          AS months_back,      -- 최근 N개월
    0.60::numeric                    AS music_ratio,      -- 음악 호출 비율(0~1)
    0.80::numeric                    AS music_full_ratio, -- 음악 호출 중 멜로디+가사 비율(나머지는 Inst)
    1.0::numeric                     AS price_per_call
),
-- 회사별 스케일(일일 호출 수 범위, 리워드 배율)
scale AS (
  SELECT * FROM (
    VALUES
      (1, 40, 70, 1.00),  -- 회사 1: 많은 호출
      (2, 20, 40, 0.85),  -- 회사 2: 중간 호출
      (3,  8, 18, 0.70)   -- 회사 3: 적은 호출
  ) AS t(company_id, min_calls, max_calls, reward_mul)
),
-- 기준 월(KST)과 삭제 기준 시점
anchor AS (
  SELECT (date_trunc('month', (now() AT TIME ZONE 'Asia/Seoul')))::timestamp AS month_kst FROM _config
),
cutoff AS (
  SELECT (SELECT month_kst FROM anchor) - make_interval(months => (SELECT months_back-1 FROM _config)) AS delete_since FROM _config
)

-- 1) 기존 더미 삭제: 지정 회사들의 최근 N개월 범위만 삭제
DELETE FROM music_plays
WHERE using_company_id IN (
  SELECT UNNEST(company_ids)::bigint FROM _config
)
  AND created_at >= (SELECT delete_since FROM cutoff);

-- 2) company_musics 매핑 준비: 대상 회사 × 대상 음원 풀 매핑 (이미 있으면 유지)
INSERT INTO company_musics (company_id, music_id)
SELECT c::bigint, m::bigint
FROM unnest((SELECT company_ids FROM _config)) AS c
CROSS JOIN unnest((SELECT music_ids FROM _config)) AS m
ON CONFLICT DO NOTHING;

-- 3) music_plays 더미 생성
WITH params AS (
  SELECT
    company_ids,
    music_ids,
    months_back,
    music_ratio,
    music_full_ratio,
    price_per_call,
    (SELECT month_kst FROM anchor) AS month_kst
  FROM _config
),
months AS (
  SELECT generate_series(0, (SELECT months_back FROM params)-1) AS idx
),
month_bounds AS (
  SELECT 
    ( (SELECT month_kst FROM params) - make_interval(months => idx) )::date AS month_start,
    ( ( (SELECT month_kst FROM params) - make_interval(months => idx) )::date + INTERVAL '1 month' - INTERVAL '1 second') AS month_end
  FROM months
),
all_days AS (
  SELECT d::date AS d
  FROM month_bounds mb
  CROSS JOIN LATERAL generate_series(mb.month_start, mb.month_end, INTERVAL '1 day') AS d
),
per_company_day AS (
  SELECT 
    s.company_id,
    ad.d,
    (s.min_calls + floor(random() * (s.max_calls - s.min_calls + 1)))::int AS calls,
    s.reward_mul
  FROM all_days ad
  JOIN scale s ON TRUE
),
expanded_calls AS (
  SELECT 
    company_id,
    d,
    reward_mul,
    generate_series(1, calls) AS n
  FROM per_company_day
),
random_pick AS (
  -- 각 호출별 music_id, use_case 코드('0','1','2'), reward 값 산출
  SELECT 
    ec.company_id,
    ec.d,
    ec.reward_mul,
    (SELECT music_ids[ 1 + floor(random() * array_length(music_ids,1))::int ] FROM params) AS music_id,
    -- 음악/가사 선택 → 음악이면 '0'(멜로디+가사) 또는 '1'(Inst)로 분기
    CASE 
      WHEN random() < (SELECT music_ratio FROM params) THEN 
        CASE WHEN random() < (SELECT music_full_ratio FROM params) THEN '0' ELSE '1' END
      ELSE '2'
    END AS use_case_code
  FROM expanded_calls ec
),
final_rows AS (
  SELECT 
    music_id,
    company_id AS using_company_id,
    true AS is_valid_play,
    -- 호출당 리워드 금액: 타입/스케일 반영
    CASE 
      WHEN use_case_code IN ('0','1') THEN ((0.008 + random()*0.004) * reward_mul)
      ELSE ((0.005 + random()*0.003) * reward_mul)
    END::numeric(12,3) AS reward_amount,
    -- enum reward_code: 1(정상 발생) 위주로 생성
    '1'::reward_code AS reward_code,
    -- enum use_case 코드('0','1','2') 그대로 캐스팅
    use_case_code::use_case AS use_case,
    (SELECT price_per_call FROM params)::numeric(12,3) AS use_price,
    (45 + floor(random()*196))::int AS play_duration_sec,
    make_timestamptz(EXTRACT(YEAR FROM d)::int, EXTRACT(MONTH FROM d)::int, EXTRACT(DAY FROM d)::int,
                     floor(random()*24)::int, floor(random()*60)::int, floor(random()*60)::int,
                     'Asia/Seoul') AS created_at
  FROM random_pick
)
INSERT INTO music_plays (
  music_id, using_company_id, is_valid_play, reward_amount, reward_code, use_case, use_price, play_duration_sec, created_at
)
SELECT 
  music_id, using_company_id, is_valid_play, reward_amount, reward_code, use_case, use_price, play_duration_sec, created_at
FROM final_rows;

-- 확인(선택)
-- SELECT use_case, COUNT(*) FROM music_plays GROUP BY 1 ORDER BY 1;
-- SELECT to_char(created_at, 'YYYY-MM') ym, use_case, COUNT(*) FROM music_plays GROUP BY 1,2 ORDER BY 1,2; 


WITH params AS (
  SELECT '2025-09'::text AS ym, 18::bigint AS music_id
),
month_range AS (
  SELECT
    make_timestamptz(split_part(ym,'-',1)::int, split_part(ym,'-',2)::int, 1, 0, 0, 0, 'Asia/Seoul') AS month_start,
    (make_timestamptz(split_part(ym,'-',1)::int, split_part(ym,'-',2)::int, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second' AS month_end
  FROM params
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
  p.valid_plays,
  p.earned,
  p.companies_using,
  to_char(p.last_used_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS last_used_at,
  mmr.total_reward_count AS total_reward_count,
  mmr.remaining_reward_count AS remaining_reward_count,
  mmr.reward_per_play,
  -- 단계별 계산 결과
  CASE
    WHEN mmr.total_reward_count IS NULL OR mmr.total_reward_count <= 0 THEN NULL
    WHEN mmr.remaining_reward_count IS NOT NULL AND mmr.remaining_reward_count >= 0 THEN
      ROUND(((mmr.total_reward_count - mmr.remaining_reward_count)::numeric / NULLIF(mmr.total_reward_count, 0)::numeric) * 100)
    ELSE NULL
  END AS usage_from_remaining_pct,
  CASE
    WHEN mmr.total_reward_count IS NOT NULL AND mmr.total_reward_count > 0
     AND mmr.reward_per_play IS NOT NULL AND mmr.reward_per_play > 0 THEN
      ROUND((FLOOR(COALESCE(p.earned, 0) / NULLIF(mmr.reward_per_play, 0))::numeric / NULLIF(mmr.total_reward_count, 0)::numeric) * 100)
    ELSE NULL
  END AS usage_from_earned_pct,
  CASE
    WHEN mmr.total_reward_count IS NOT NULL AND mmr.total_reward_count > 0 THEN
      ROUND((LEAST(COALESCE(p.valid_plays, 0), mmr.total_reward_count)::numeric / NULLIF(mmr.total_reward_count, 0)::numeric) * 100)
    ELSE NULL
  END AS usage_from_valid_plays_pct,
  -- 최종 사용률(서비스 로직과 동일한 우선순위)
  CASE
    WHEN mmr.total_reward_count IS NULL OR mmr.total_reward_count <= 0 THEN NULL
    WHEN mmr.remaining_reward_count IS NOT NULL AND mmr.remaining_reward_count >= 0 THEN
      ROUND(((mmr.total_reward_count - mmr.remaining_reward_count)::numeric / NULLIF(mmr.total_reward_count, 0)::numeric) * 100)
    WHEN mmr.reward_per_play IS NOT NULL AND mmr.reward_per