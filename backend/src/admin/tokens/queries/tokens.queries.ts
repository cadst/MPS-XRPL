import { db } from '../../../db/client'
import { companies, rewards, music_plays } from '../../../db/schema'
import { sql } from 'drizzle-orm'

export class TokensQueries {
  // 총 발행량 계산 (companies.total_rewards_earned 합계)
  async getTotalIssuedTokens(): Promise<number> {
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(${companies.total_rewards_earned}::numeric), 0)`
      })
      .from(companies)
    
    return parseFloat(result[0].total.toString())
  }

  // 총 소각량 계산 (rewards 테이블에서 소각된 토큰)
  async getTotalBurnedTokens(): Promise<number> {
    // 소각은 일반적으로 특정 주소(0x000...000)로 전송되는 것으로 가정
    // 실제 구현에서는 소각 이벤트나 특정 상태를 확인해야 함
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(${rewards.amount}::numeric), 0)`
      })
      .from(rewards)
      .where(sql`${rewards.status} = 'falied'`) // 실패한 리워드는 소각으로 간주
    
    return parseFloat(result[0].total.toString())
  }

  // 일별 배치 데이터 조회
  async getDailyBatches(limit: number, offset: number) {
    // music_plays와 rewards 테이블을 조인하여 일별 집계
    const result = await db
      .select({
        date: sql<string>`DATE(${music_plays.created_at})`,
        totalReward: sql<number>`COALESCE(SUM(${rewards.amount}::numeric), 0)`,
        dbValidPlayCount: sql<number>`COUNT(CASE WHEN ${music_plays.is_valid_play} = true THEN 1 END)`,
        onchainRecordedPlayCount: sql<number>`COUNT(CASE WHEN ${rewards.payout_tx_hash} IS NOT NULL THEN 1 END)`,
        executedAt: sql<string>`MAX(${rewards.blockchain_recorded_at})`,
        txHash: sql<string>`MAX(${rewards.payout_tx_hash})`,
        status: sql<string>`
          CASE 
            WHEN MAX(${rewards.payout_tx_hash}) IS NOT NULL THEN 'success'
            WHEN COUNT(CASE WHEN ${music_plays.is_valid_play} = true THEN 1 END) > 0 THEN 'not-executed'
            ELSE 'not-executed'
          END
        `,
        blockNumber: sql<number>`MAX(${rewards.block_number})`,
        gasUsed: sql<number>`MAX(${rewards.gas_used})`
      })
      .from(music_plays)
      .leftJoin(rewards, sql`${rewards.play_id} = ${music_plays.id}`)
      .where(sql`${music_plays.created_at} >= NOW() - INTERVAL '30 days'`)
      .groupBy(sql`DATE(${music_plays.created_at})`)
      .orderBy(sql`DATE(${music_plays.created_at}) DESC`)
      .limit(limit)
      .offset(offset)

    return result.map(row => ({
      id: row.date,
      date: row.date,
      executedAt: row.executedAt,
      totalReward: parseFloat(row.totalReward.toString()),
      dbValidPlayCount: parseInt(row.dbValidPlayCount.toString()),
      onchainRecordedPlayCount: parseInt(row.onchainRecordedPlayCount.toString()),
      txHash: row.txHash,
      status: row.status as 'success' | 'pending' | 'not-executed' | 'failed',
      mismatch: row.dbValidPlayCount !== row.onchainRecordedPlayCount,
      blockNumber: row.blockNumber,
      gasUsed: row.gasUsed
    }))
  }

  // 특정 날짜의 배치 상세 정보
  async getBatchDetail(date: string) {
    const result = await db
      .select({
        date: sql<string>`DATE(${music_plays.created_at})`,
        totalReward: sql<number>`COALESCE(SUM(${rewards.amount}::numeric), 0)`,
        dbValidPlayCount: sql<number>`COUNT(CASE WHEN ${music_plays.is_valid_play} = true THEN 1 END)`,
        onchainRecordedPlayCount: sql<number>`COUNT(CASE WHEN ${rewards.payout_tx_hash} IS NOT NULL THEN 1 END)`,
        executedAt: sql<string>`MAX(${rewards.blockchain_recorded_at})`,
        txHash: sql<string>`MAX(${rewards.payout_tx_hash})`,
        status: sql<string>`
          CASE 
            WHEN MAX(${rewards.payout_tx_hash}) IS NOT NULL THEN 'success'
            WHEN COUNT(CASE WHEN ${music_plays.is_valid_play} = true THEN 1 END) > 0 THEN 'not-executed'
            ELSE 'not-executed'
          END
        `,
        blockNumber: sql<number>`MAX(${rewards.block_number})`,
        gasUsed: sql<number>`MAX(${rewards.gas_used})`
      })
      .from(music_plays)
      .leftJoin(rewards, sql`${rewards.play_id} = ${music_plays.id}`)
      .where(sql`DATE(${music_plays.created_at}) = ${date}`)
      .groupBy(sql`DATE(${music_plays.created_at})`)

    if (result.length === 0) return null

    const row = result[0]
    return {
      id: row.date,
      date: row.date,
      executedAt: row.executedAt,
      totalReward: parseFloat(row.totalReward.toString()),
      dbValidPlayCount: parseInt(row.dbValidPlayCount.toString()),
      onchainRecordedPlayCount: parseInt(row.onchainRecordedPlayCount.toString()),
      txHash: row.txHash,
      status: row.status as 'success' | 'pending' | 'not-executed' | 'failed',
      mismatch: row.dbValidPlayCount !== row.onchainRecordedPlayCount,
      blockNumber: row.blockNumber,
      gasUsed: row.gasUsed
    }
  }

  // 기업별 리워드 분배 데이터
  async getCompanyDistributions(date: string) {
    const result = await db
      .select({
        companyName: companies.name,
        amount: sql<number>`COALESCE(SUM(${rewards.amount}::numeric), 0)`,
        percent: sql<number>`0` // 나중에 계산
      })
      .from(music_plays)
      .leftJoin(rewards, sql`${rewards.play_id} = ${music_plays.id}`)
      .leftJoin(companies, sql`${companies.id} = ${music_plays.using_company_id}`)
      .where(sql`DATE(${music_plays.created_at}) = ${date} AND ${music_plays.is_valid_play} = true`)
      .groupBy(companies.name)
      .orderBy(sql`SUM(${rewards.amount}::numeric) DESC`)

    // 총합 계산
    const totalAmount = result.reduce((sum, row) => sum + parseFloat(row.amount.toString()), 0)
    
    return result.map(row => ({
      company: row.companyName,
      amount: parseFloat(row.amount.toString()),
      percent: totalAmount > 0 ? (parseFloat(row.amount.toString()) / totalAmount) * 100 : 0
    }))
  }

  // 유효재생 히스토리
  async getValidPlayHistory(date: string) {
    const result = await db
      .select({
        id: music_plays.id,
        time: sql<string>`TO_CHAR(${music_plays.created_at}, 'HH24:MI:SS')`,
        companyName: companies.name,
        musicTitle: sql<string>`m.title`,
        musicId: sql<string>`m.id::text`
      })
      .from(music_plays)
      .leftJoin(companies, sql`${companies.id} = ${music_plays.using_company_id}`)
      .leftJoin(sql`musics m`, sql`m.id = ${music_plays.music_id}`)
      .where(sql`DATE(${music_plays.created_at}) = ${date} AND ${music_plays.is_valid_play} = true`)
      .orderBy(music_plays.created_at)
      .limit(50) // 최대 50개만 표시

    return result.map(row => ({
      id: `play-${row.id}`,
      time: row.time,
      company: row.companyName,
      musicTitle: row.musicTitle,
      musicId: row.musicId
    }))
  }

  // 트랜잭션 목록 조회 (토큰 분배 + API 호출 기록)
  async getTransactions(limit: number, offset: number) {
    // 토큰 분배 트랜잭션 (payout_tx_hash로 그룹핑)
    const tokenDistributionTxs = await db
      .select({
        id: sql<string>`'token-dist-' || DATE(${rewards.blockchain_recorded_at})`,
        type: sql<string>`'token-distribution'`,
        timestamp: sql<string>`TO_CHAR(DATE(${rewards.blockchain_recorded_at}), 'YYYY-MM-DD') || ' 00:00:00'`,
        txHash: rewards.payout_tx_hash,
        status: sql<string>`
          CASE 
            WHEN ${rewards.payout_tx_hash} IS NOT NULL THEN 'success'
            WHEN ${rewards.status} = 'pending' THEN 'pending'
            ELSE 'failed'
          END
        `,
        blockNumber: rewards.block_number,
        gasUsed: rewards.gas_used,
        gasPrice: sql<number>`20`, // 더미 값
        totalAmount: sql<number>`SUM(${rewards.amount}::numeric)`,
        recipientCount: sql<number>`COUNT(*)`
      })
      .from(rewards)
      .where(sql`${rewards.blockchain_recorded_at} IS NOT NULL`)
      .groupBy(
        sql`DATE(${rewards.blockchain_recorded_at})`,
        rewards.payout_tx_hash,
        rewards.block_number,
        rewards.gas_used,
        rewards.status
      )
      .orderBy(sql`DATE(${rewards.blockchain_recorded_at}) DESC`)
      .limit(limit / 2)
      .offset(offset / 2)

    // API 호출 기록 트랜잭션 (날짜별로 그룹핑)
    const apiRecordingTxs = await db
      .select({
        id: sql<string>`'api-rec-' || DATE(${music_plays.created_at})`,
        type: sql<string>`'api-recording'`,
        timestamp: sql<string>`TO_CHAR(DATE(${music_plays.created_at}), 'YYYY-MM-DD') || ' 00:00:00'`,
        txHash: sql<string>`'0x' || lpad(to_hex(EXTRACT(EPOCH FROM DATE(${music_plays.created_at}))::bigint), 8, '0') || lpad(to_hex((EXTRACT(EPOCH FROM DATE(${music_plays.created_at}))::bigint % 1000000)), 8, '0') || '0000000000000001'`, // API 호출용 해시
        status: sql<string>`'success'`,
        blockNumber: sql<number>`18000000 + (EXTRACT(EPOCH FROM DATE(${music_plays.created_at}))::bigint % 1000000)::integer + 1`, // 토큰 분배보다 1 높게
        gasUsed: sql<number>`150000 + (EXTRACT(EPOCH FROM DATE(${music_plays.created_at}))::bigint % 50000)::bigint`, // API 호출용 가스
        gasPrice: sql<number>`20`, // 더미 값
        recordCount: sql<number>`COUNT(*)`
      })
      .from(music_plays)
      .where(sql`${music_plays.is_valid_play} = true AND ${music_plays.created_at} >= NOW() - INTERVAL '30 days'`)
      .groupBy(sql`DATE(${music_plays.created_at})`)
      .orderBy(sql`DATE(${music_plays.created_at}) DESC`)
      .limit(limit / 2)
      .offset(offset / 2)

    // 두 결과를 합치고 정렬
    const allTransactions = [
      ...tokenDistributionTxs.map(tx => ({
        id: tx.id,
        type: tx.type as 'token-distribution',
        timestamp: tx.timestamp,
        txHash: tx.txHash || '',
        status: tx.status as 'success' | 'pending' | 'failed',
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        tokenDistribution: {
          totalAmount: parseFloat(tx.totalAmount.toString()),
          recipientCount: parseInt(tx.recipientCount.toString()),
          recipients: [] // 상세 조회에서 채움
        }
      })),
      ...apiRecordingTxs.map(tx => ({
        id: tx.id,
        type: tx.type as 'api-recording',
        timestamp: tx.timestamp,
        txHash: tx.txHash || '',
        status: tx.status as 'success' | 'pending' | 'failed',
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        apiRecording: {
          recordCount: parseInt(tx.recordCount.toString()),
          records: [] // 상세 조회에서 채움
        }
      }))
    ]

    // 타임스탬프 기준으로 정렬
    return allTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  // 트랜잭션 상세 조회
  async getTransactionDetail(id: string) {
    if (id.startsWith('token-dist-')) {
      const dateStr = id.replace('token-dist-', '') // YYYY-MM-DD 형식
      
      // 토큰 분배 트랜잭션 상세 (해당 날짜의 모든 기업 분배 내역)
      const result = await db
        .select({
          id: sql<string>`'token-dist-' || DATE(${rewards.blockchain_recorded_at})`,
          type: sql<string>`'token-distribution'`,
          timestamp: sql<string>`TO_CHAR(DATE(${rewards.blockchain_recorded_at}), 'YYYY-MM-DD') || ' 00:00:00'`,
          txHash: rewards.payout_tx_hash,
          status: sql<string>`
            CASE 
              WHEN ${rewards.payout_tx_hash} IS NOT NULL THEN 'success'
              WHEN ${rewards.status} = 'pending' THEN 'pending'
              ELSE 'failed'
            END
          `,
          blockNumber: rewards.block_number,
          gasUsed: rewards.gas_used,
          gasPrice: sql<number>`20`,
          amount: rewards.amount,
          companyName: companies.name,
          companyId: rewards.company_id,
          musicId: rewards.music_id,
          rewardCode: rewards.reward_code,
          usedAt: rewards.created_at
        })
        .from(rewards)
        .leftJoin(companies, sql`${companies.id} = ${rewards.company_id}`)
        .where(sql`DATE(${rewards.blockchain_recorded_at}) = ${dateStr}`)
        .orderBy(rewards.created_at)

      if (result.length === 0) return null

      const firstRow = result[0]
      const totalAmount = result.reduce((sum, row) => sum + parseFloat(row.amount.toString()), 0)
      
      return {
        id: firstRow.id,
        type: 'token-distribution' as const,
        timestamp: firstRow.timestamp,
        txHash: firstRow.txHash || '',
        status: firstRow.status as 'success' | 'pending' | 'failed',
        blockNumber: firstRow.blockNumber,
        gasUsed: firstRow.gasUsed,
        gasPrice: firstRow.gasPrice,
        tokenDistribution: {
          totalAmount: totalAmount,
          recipientCount: result.length,
          recipients: result.map(row => ({
            company: row.companyName,
            amount: parseFloat(row.amount.toString()),
            companyId: parseInt(row.companyId.toString()),
            musicId: parseInt(row.musicId.toString()),
            rewardCode: row.rewardCode,
            usedAt: row.usedAt
          }))
        }
      }
    } else if (id.startsWith('api-rec-')) {
      const dateStr = id.replace('api-rec-', '') // YYYY-MM-DD 형식
      
      // API 호출 기록 트랜잭션 상세 (해당 날짜의 모든 API 호출 내역)
      const result = await db
        .select({
          id: sql<string>`'api-rec-' || DATE(${music_plays.created_at})`,
          type: sql<string>`'api-recording'`,
          timestamp: sql<string>`TO_CHAR(DATE(${music_plays.created_at}), 'YYYY-MM-DD') || ' 00:00:00'`,
          txHash: sql<string>`'0x' || lpad(to_hex(EXTRACT(EPOCH FROM DATE(${music_plays.created_at}))::bigint), 8, '0') || lpad(to_hex((EXTRACT(EPOCH FROM DATE(${music_plays.created_at}))::bigint % 1000000)), 8, '0') || '0000000000000001'`, // API 호출용 해시
          status: sql<string>`'success'`,
          blockNumber: sql<number>`18000000 + (EXTRACT(EPOCH FROM DATE(${music_plays.created_at}))::bigint % 1000000)::integer + 1`, // 토큰 분배보다 1 높게
          gasUsed: sql<number>`150000 + (EXTRACT(EPOCH FROM DATE(${music_plays.created_at}))::bigint % 50000)::bigint`, // API 호출용 가스
          gasPrice: sql<number>`20`, // 더미 값
          companyId: music_plays.using_company_id,
          musicId: music_plays.music_id,
          playId: music_plays.id,
          rewardCode: sql<number>`0`, // API 호출 기록에는 리워드 코드 없음
          companyName: companies.name,
          usedAt: music_plays.created_at
        })
        .from(music_plays)
        .leftJoin(companies, sql`${companies.id} = ${music_plays.using_company_id}`)
        .where(sql`DATE(${music_plays.created_at}) = ${dateStr} AND ${music_plays.is_valid_play} = true`)
        .orderBy(music_plays.created_at)

      if (result.length === 0) return null

      const firstRow = result[0]
      
      return {
        id: firstRow.id,
        type: 'api-recording' as const,
        timestamp: firstRow.timestamp,
        txHash: firstRow.txHash || '',
        status: firstRow.status as 'success' | 'pending' | 'failed',
        blockNumber: firstRow.blockNumber,
        gasUsed: firstRow.gasUsed,
        gasPrice: firstRow.gasPrice,
        apiRecording: {
          recordCount: result.length,
          records: result.map(row => ({
            companyId: parseInt(row.companyId.toString()),
            musicId: parseInt(row.musicId.toString()),
            playId: parseInt(row.playId.toString()),
            rewardCode: parseInt(row.rewardCode.toString()),
            timestamp: row.usedAt,
            companyName: row.companyName
          }))
        }
      }
    }

    return null
  }
}
