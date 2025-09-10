-- rewards 테이블에 더미 데이터 생성
-- 기존 companies, musics, music_plays 데이터를 활용

-- 같은 날짜의 모든 리워드는 같은 payout_tx_hash를 가져야 함
WITH daily_tx_hashes AS (
  SELECT DISTINCT
    DATE(mp.created_at) as reward_date,
    '0x' || lpad(to_hex(EXTRACT(EPOCH FROM DATE(mp.created_at))::bigint), 8, '0') || 
    lpad(to_hex((EXTRACT(EPOCH FROM DATE(mp.created_at))::bigint % 1000000)), 8, '0') || 
    '0000000000000000' as daily_tx_hash,
    18000000 + (EXTRACT(EPOCH FROM DATE(mp.created_at))::bigint % 1000000)::integer as daily_block_number,
    200000 + (EXTRACT(EPOCH FROM DATE(mp.created_at))::bigint % 100000)::bigint as daily_gas_used
  FROM music_plays mp
  WHERE mp.is_valid_play = true
    AND mp.created_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE(mp.created_at)
)
INSERT INTO rewards (
  company_id, 
  music_id, 
  play_id, 
  reward_code, 
  amount, 
  status, 
  payout_tx_hash, 
  block_number, 
  gas_used, 
  blockchain_recorded_at,
  created_at,
  updated_at
)
SELECT 
  mp.using_company_id as company_id,
  mp.music_id,
  mp.id as play_id,
  CASE 
    WHEN mp.use_case = '0' THEN '0'::reward_code
    WHEN mp.use_case = '1' THEN '1'::reward_code
    WHEN mp.use_case = '2' THEN '2'::reward_code
    ELSE '0'::reward_code
  END as reward_code,
  CASE 
    WHEN mp.use_case = '0' THEN '10'::numeric
    WHEN mp.use_case = '1' THEN '15'::numeric
    WHEN mp.use_case = '2' THEN '5'::numeric
    ELSE '10'::numeric
  END as amount,
  'successed'::reward_status as status,
  dth.daily_tx_hash as payout_tx_hash,
  dth.daily_block_number as block_number,
  dth.daily_gas_used as gas_used,
  DATE(mp.created_at) + INTERVAL '1 minute' as blockchain_recorded_at, -- 자정에 실행되는 것으로 가정
  mp.created_at,
  NOW()
FROM music_plays mp
JOIN daily_tx_hashes dth ON DATE(mp.created_at) = dth.reward_date
WHERE mp.is_valid_play = true
  AND mp.created_at > NOW() - INTERVAL '30 days'
ORDER BY mp.created_at DESC
LIMIT 1000;

-- 결과 확인
SELECT 
  COUNT(*) as total_rewards,
  COUNT(CASE WHEN status = 'successed' THEN 1 END) as successful_rewards,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_rewards,
  COUNT(CASE WHEN payout_tx_hash IS NOT NULL THEN 1 END) as with_tx_hash
FROM rewards;


-- 같은 날짜의 모든 리워드는 같은 payout_tx_hash를 가져야 함
WITH daily_tx_hashes AS (
  SELECT DISTINCT
    DATE(mp.created_at) as reward_date,
    '0x' || lpad(to_hex(EXTRACT(EPOCH FROM DATE(mp.created_at))::bigint), 8, '0') || 
    lpad(to_hex((EXTRACT(EPOCH FROM DATE(mp.created_at))::bigint % 1000000)), 8, '0') || 
    '0000000000000000' as daily_tx_hash,
    18000000 + (EXTRACT(EPOCH FROM DATE(mp.created_at))::bigint % 1000000)::integer as daily_block_number,
    200000 + (EXTRACT(EPOCH FROM DATE(mp.created_at))::bigint % 100000)::bigint as daily_gas_used
  FROM music_plays mp
  WHERE mp.is_valid_play = true
    AND mp.created_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE(mp.created_at)
)
INSERT INTO rewards (
  company_id, 
  music_id, 
  play_id, 
  reward_code, 
  amount, 
  status, 
  payout_tx_hash, 
  block_number, 
  gas_used, 
  blockchain_recorded_at,
  created_at,
  updated_at
)
SELECT 
  mp.using_company_id as company_id,
  mp.music_id,
  mp.id as play_id,
  CASE 
    WHEN mp.use_case = '0' THEN '0'::reward_code
    WHEN mp.use_case = '1' THEN '1'::reward_code
    WHEN mp.use_case = '2' THEN '2'::reward_code
    ELSE '0'::reward_code
  END as reward_code,
  CASE 
    WHEN mp.use_case = '0' THEN '10'::numeric
    WHEN mp.use_case = '1' THEN '15'::numeric
    WHEN mp.use_case = '2' THEN '5'::numeric
    ELSE '10'::numeric
  END as amount,
  CASE 
    WHEN mp.id % 3 = 0 THEN 'pending'::reward_status  -- 1/3은 pending
    ELSE 'successed'::reward_status                    -- 2/3은 successed
  END as status,
  CASE 
    WHEN mp.created_at > NOW() - INTERVAL '1 day' THEN NULL
    ELSE dth.daily_tx_hash
  END as payout_tx_hash,
  CASE 
    WHEN mp.created_at > NOW() - INTERVAL '1 day' THEN NULL
    ELSE dth.daily_block_number
  END as block_number,
  CASE 
    WHEN mp.created_at > NOW() - INTERVAL '1 day' THEN NULL
    ELSE dth.daily_gas_used
  END as gas_used,
  CASE 
    WHEN mp.created_at > NOW() - INTERVAL '1 day' THEN NULL
    ELSE DATE(mp.created_at) + INTERVAL '1 minute' -- 자정에 실행되는 것으로 가정
  END as blockchain_recorded_at,
  mp.created_at,
  NOW()
FROM music_plays mp
JOIN daily_tx_hashes dth ON DATE(mp.created_at) = dth.reward_date
WHERE mp.is_valid_play = true
  AND mp.created_at > NOW() - INTERVAL '30 days'
ORDER BY mp.created_at DESC
LIMIT 1000;

-- 결과 확인
SELECT 
  COUNT(*) as total_rewards,
  COUNT(CASE WHEN status = 'successed' THEN 1 END) as successful_rewards,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_rewards,
  COUNT(CASE WHEN payout_tx_hash IS NOT NULL THEN 1 END) as with_tx_hash
FROM rewards;
