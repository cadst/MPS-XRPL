-- =============================================
-- Seed: company_subscriptions (KST)
-- 사용법:
--   1) 필요 시 아래 _config 값을 수정하세요
--   2) psql 등으로 본 스크립트를 실행하세요
-- =============================================

-- 설정값 (필요 시 수정)
WITH _config AS (
  SELECT 
    NULL::bigint[]                 AS company_ids,   -- 특정 회사만 대상이면 배열 입력, NULL이면 전체 companies 사용
    12::int                        AS months_back,   -- 최근 N개월
    'Asia/Seoul'::text             AS tz,
    0.65::numeric                  AS p_always_on,   -- 영구 유지 구독 확률
    0.25::numeric                  AS p_single_gap,  -- 한 달만 쉬는 구독 확률(재구독 유도)
    0.10::numeric                  AS p_churn_from   -- 특정 시점 이후 영구 해지 확률
),
-- 기준 월(KST)
anchor AS (
  SELECT (date_trunc('month', (now() AT TIME ZONE (SELECT tz FROM _config))))::timestamp AS month_kst FROM _config
),
-- 대상 회사 목록
target_companies AS (
  SELECT 
    COALESCE(
      (SELECT company_ids FROM _config),
      (SELECT array_agg(id)::bigint[] FROM companies)
    ) AS ids
),
companies_expanded AS (
  SELECT UNNEST(ids) AS company_id FROM target_companies
),
-- 회사별 고정 요금제 배정(가중치: Free 10%, Standard 55%, Business 35%)
company_tier AS (
  SELECT 
    c.company_id,
    CASE 
      WHEN random() < 0.10 THEN 'free'
      WHEN random() < 0.55 THEN 'standard'
      ELSE 'business'
    END AS tier
  FROM companies_expanded c
),
-- 월 시퀀스(0=이번달, 1=전월 ...)
month_series AS (
  SELECT generate_series(0, (SELECT months_back FROM _config)-1) AS idx
),
-- 각 회사별 구독 상태 계획(영구 유지/한달 쉬기/영구 해지)
churn_plan AS (
  SELECT 
    ct.company_id,
    ct.tier,
    -- 플래그는 회사별로 한 번만 샘플링
    (random() < (SELECT p_always_on FROM _config)) AS always_on,
    (random() < (SELECT p_single_gap FROM _config)) AS single_gap,
    FLOOR(random() * (SELECT months_back FROM _config))::int AS gap_idx, -- 쉬는 달 index
    FLOOR(random() * (SELECT months_back FROM _config))::int AS churn_from_idx -- 이 인덱스부터 영구 해지
  FROM company_tier ct
),
-- 월별 행 확장 + 활성 여부 결정
plan_months AS (
  SELECT 
    cp.company_id,
    cp.tier,
    ms.idx,
    (SELECT month_kst FROM anchor) - make_interval(months => ms.idx) AS month_start,
    ((SELECT month_kst FROM anchor) - make_interval(months => ms.idx) + interval '1 month' - interval '1 second') AS month_end,
    CASE 
      WHEN cp.always_on THEN true
      WHEN cp.single_gap THEN ms.idx <> cp.gap_idx
      ELSE ms.idx < cp.churn_from_idx
    END AS is_active
  FROM churn_plan cp
  CROSS JOIN month_series ms
),
-- 금액 산정 (등급별 기본가 + 리워드 할인 + 실결제액)
priced AS (
  SELECT 
    pm.company_id,
    pm.tier,
    pm.idx,
    pm.month_start,
    pm.month_end,
    pm.is_active,
    CASE pm.tier 
      WHEN 'business' THEN 1200000
      WHEN 'standard' THEN 500000
      ELSE 0
    END::numeric(12,2) AS base_price,
    CASE pm.tier
      WHEN 'business' THEN ROUND(((0.10 + random()*0.20) * 1200000)::numeric, 2)  -- 10~30% 할인
      WHEN 'standard' THEN ROUND(((0.08 + random()*0.15) * 500000)::numeric, 2)   -- 8~23% 할인
      ELSE 0
    END::numeric(12,2) AS discount_amount
  FROM plan_months pm
),
final_rows AS (
  SELECT 
    company_id,
    tier,
    month_start AS start_date,
    month_end   AS end_date,
    base_price AS total_paid_amount,
    1::int AS payment_count,
    GREATEST(0, LEAST(discount_amount, base_price))::numeric(12,2) AS discount_amount,
    GREATEST(0, base_price - GREATEST(0, LEAST(discount_amount, base_price)))::numeric(12,2) AS actual_paid_amount
  FROM priced
  WHERE is_active = true
)
-- 기존 구간 데이터 제거 (대상 회사의 최근 N개월 범위에 겹치는 구독 레코드 정리)
DELETE FROM company_subscriptions cs
USING (
  SELECT 
    MIN(month_start) AS min_start,
    MAX(month_end) AS max_end
  FROM plan_months
) r
WHERE cs.company_id IN (SELECT company_id FROM companies_expanded)
  AND cs.end_date >= r.min_start
  AND cs.start_date <= r.max_end;

-- 신규 더미 삽입
WITH _config AS (
  SELECT 
    NULL::bigint[]                 AS company_ids,
    12::int                        AS months_back,
    'Asia/Seoul'::text             AS tz,
    0.65::numeric                  AS p_always_on,
    0.25::numeric                  AS p_single_gap,
    0.10::numeric                  AS p_churn_from
),
anchor AS (
  SELECT (date_trunc('month', (now() AT TIME ZONE (SELECT tz FROM _config))))::timestamp AS month_kst FROM _config
),
target_companies AS (
  SELECT 
    COALESCE(
      (SELECT company_ids FROM _config),
      (SELECT array_agg(id)::bigint[] FROM companies)
    ) AS ids
),
companies_expanded AS (
  SELECT UNNEST(ids) AS company_id FROM target_companies
),
company_tier AS (
  SELECT 
    c.company_id,
    CASE 
      WHEN random() < 0.10 THEN 'free'
      WHEN random() < 0.55 THEN 'standard'
      ELSE 'business'
    END AS tier
  FROM companies_expanded c
),
month_series AS (
  SELECT generate_series(0, (SELECT months_back FROM _config)-1) AS idx
),
churn_plan AS (
  SELECT 
    ct.company_id,
    ct.tier,
    (random() < (SELECT p_always_on FROM _config)) AS always_on,
    (random() < (SELECT p_single_gap FROM _config)) AS single_gap,
    FLOOR(random() * (SELECT months_back FROM _config))::int AS gap_idx,
    FLOOR(random() * (SELECT months_back FROM _config))::int AS churn_from_idx
  FROM company_tier ct
),
plan_months AS (
  SELECT 
    cp.company_id,
    cp.tier,
    ms.idx,
    (SELECT month_kst FROM anchor) - make_interval(months => ms.idx) AS month_start,
    ((SELECT month_kst FROM anchor) - make_interval(months => ms.idx) + interval '1 month' - interval '1 second') AS month_end,
    CASE 
      WHEN cp.always_on THEN true
      WHEN cp.single_gap THEN ms.idx <> cp.gap_idx
      ELSE ms.idx < cp.churn_from_idx
    END AS is_active
  FROM churn_plan cp
  CROSS JOIN month_series ms
),
priced AS (
  SELECT 
    pm.company_id,
    pm.tier,
    pm.idx,
    pm.month_start,
    pm.month_end,
    pm.is_active,
    CASE pm.tier 
      WHEN 'business' THEN 1200000
      WHEN 'standard' THEN 500000
      ELSE 0
    END::numeric(12,2) AS base_price,
    CASE pm.tier
      WHEN 'business' THEN ROUND(((0.10 + random()*0.20) * 1200000)::numeric, 2)  -- 10~30% 할인
      WHEN 'standard' THEN ROUND(((0.08 + random()*0.15) * 500000)::numeric, 2)   -- 8~23% 할인
      ELSE 0
    END::numeric(12,2) AS discount_amount
  FROM plan_months pm
),
final_rows AS (
  SELECT 
    company_id,
    tier,
    month_start AS start_date,
    month_end   AS end_date,
    base_price AS total_paid_amount,
    1::int AS payment_count,
    GREATEST(0, LEAST(discount_amount, base_price))::numeric(12,2) AS discount_amount,
    GREATEST(0, base_price - GREATEST(0, LEAST(discount_amount, base_price)))::numeric(12,2) AS actual_paid_amount
  FROM priced
  WHERE is_active = true
)
INSERT INTO company_subscriptions (
  company_id, tier, start_date, end_date, total_paid_amount, payment_count, discount_amount, actual_paid_amount
)
SELECT 
  company_id, tier, start_date, end_date, total_paid_amount, payment_count, discount_amount, actual_paid_amount
FROM final_rows
ORDER BY company_id, start_date DESC;

-- 확인(선택)
-- 최근 2개월 활성 기업수
-- WITH cfg AS (SELECT (SELECT month_kst FROM anchor) AS m)
-- SELECT 
--   to_char((SELECT m FROM cfg), 'YYYY-MM') AS curr,
--   (SELECT COUNT(DISTINCT company_id) FROM company_subscriptions 
--     WHERE start_date < ((SELECT m FROM cfg) + interval '1 month')
--       AND end_date   >= (SELECT m FROM cfg)) AS curr_active,
--   to_char(((SELECT m FROM cfg) - interval '1 month'), 'YYYY-MM') AS prev,
--   (SELECT COUNT(DISTINCT company_id) FROM company_subscriptions 
--     WHERE start_date < (((SELECT m FROM cfg) - interval '1 month') + interval '1 month')
--       AND end_date   >= ((SELECT m FROM cfg) - interval '1 month')) AS prev_active;


