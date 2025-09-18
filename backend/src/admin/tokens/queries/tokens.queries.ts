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
        rewardedPlayCount: sql<number>`COUNT(CASE WHEN ${rewards.status} IN ('pending','successed') AND ${rewards.payout_tx_hash} IS NOT NULL THEN 1 END)`,
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
      rewardedPlayCount: parseInt(row.rewardedPlayCount.toString()),
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
        rewardedPlayCount: sql<number>`COUNT(CASE WHEN ${rewards.status} IN ('pending','successed') AND ${rewards.payout_tx_hash} IS NOT NULL THEN 1 END)`,
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
      rewardedPlayCount: parseInt(row.rewardedPlayCount.toString()),
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
        time: sql<string>`TO_CHAR(COALESCE(${rewards.created_at}, ${music_plays.created_at}), 'YYYY-MM-DD HH24:MI:SS')`,
        companyName: companies.name,
        companyId: companies.id,
        musicTitle: sql<string>`m.title`,
        musicId: sql<string>`m.id::text`
      })
      .from(music_plays)
      .leftJoin(rewards, sql`${rewards.play_id} = ${music_plays.id}`)
      .leftJoin(companies, sql`${companies.id} = ${music_plays.using_company_id}`)
      .leftJoin(sql`musics m`, sql`m.id = ${music_plays.music_id}`)
      .where(sql`DATE(${music_plays.created_at}) = ${date} AND ${music_plays.is_valid_play} = true AND (${rewards.status} IN ('pending','successed'))`)
      .orderBy(sql`COALESCE(${rewards.created_at}, ${music_plays.created_at})`)
      .limit(100)

    return result.map(row => ({
      id: `play-${row.id}`,
      time: row.time,
      company: `${row.companyName} (${row.companyId})`,
      musicTitle: `${row.musicTitle} (${row.musicId})`,
      musicId: row.musicId
    }))
  }

  // 트랜잭션 목록 조회 (토큰 분배 + API 호출 기록)
  async getTransactions(limit: number, offset: number) {
    // 1) successed = 토큰 분배: 초 단위로 그룹핑 (기존 유지)
    const successGroups = await db
      .select({
        grpIso: sql<string>`MIN(to_char(date_trunc('second', ${rewards.blockchain_recorded_at}), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))`,
        epochSec: sql<string>`EXTRACT(EPOCH FROM date_trunc('second', ${rewards.blockchain_recorded_at}))::bigint::text`,
        txHash: sql<string>`MIN(${rewards.payout_tx_hash})`,
        blockNumber: sql<number>`MAX(${rewards.block_number})`,
        gasUsed: sql<number>`MAX(${rewards.gas_used})`,
        totalAmount: sql<string>`COALESCE(SUM(${rewards.amount}::numeric), 0)::text`,
        cnt: sql<string>`COUNT(*)::text`,
        uniqCnt: sql<string>`COUNT(DISTINCT ${rewards.company_id})::text`
      })
      .from(rewards)
      .where(sql`${rewards.payout_tx_hash} IS NOT NULL AND ${rewards.blockchain_recorded_at} IS NOT NULL AND ${rewards.status} = 'successed'`)
      .groupBy(sql`date_trunc('second', ${rewards.blockchain_recorded_at})`)
      .orderBy(sql`date_trunc('second', ${rewards.blockchain_recorded_at}) DESC`)
      .limit(Math.ceil(limit / 2))
      .offset(Math.floor(offset / 2))

    // 2) api-recording = 기록 트랜잭션: 연속(earliest anchoring) 30초 윈도우로 그룹핑.
    //    정렬된 행들을 순회하면서 현재 그룹의 시작 시각(startTs)로부터 30초를 넘기 전까지 포함.
    //    그룹 대표 메타데이터는 해당 그룹의 가장 이른(첫) 행 사용.
    //    successed 행도 포함(기록 완료 후 분배된 것이라도 같은 기록 시퀀스에 속함).
    // 원본 행 전체(최근 30일 등) 읽기 -> 메모리 그룹핑 (데이터 양이 많아질 경우 추가 조건/페이징 최적화 필요).
    const rawApiRows = await db
      .select({
        id: rewards.id,
        ts: rewards.blockchain_recorded_at,
        txHash: rewards.payout_tx_hash,
        blockNumber: rewards.block_number,
        gasUsed: rewards.gas_used,
        status: rewards.status,
        amount: rewards.amount,
      })
      .from(rewards)
      .where(sql`${rewards.payout_tx_hash} IS NOT NULL AND ${rewards.blockchain_recorded_at} IS NOT NULL AND ${rewards.status} IN ('pending','successed')`)
      .orderBy(rewards.blockchain_recorded_at) // ASC

    interface ApiGroupRow { id: any; ts: Date; txHash: string | null; blockNumber: number | null; gasUsed: number | null; status: string; amount: any }
    const groups: { startTs: Date; rows: ApiGroupRow[] }[] = []
    for (const row of rawApiRows as unknown as ApiGroupRow[]) {
      if (!row.ts) continue
      if (groups.length === 0) {
        groups.push({ startTs: row.ts, rows: [row] })
        continue
      }
      const current = groups[groups.length - 1]
      const diffMs = row.ts.getTime() - current.startTs.getTime()
      if (diffMs <= 30_000) {
        current.rows.push(row)
      } else {
        // 새 그룹 시작
        groups.push({ startTs: row.ts, rows: [row] })
      }
    }

    // 그룹 -> 표시용 객체 (대표: earliest row = rows[0])
    const apiGroupsMapped = groups.map(g => {
      const rep = g.rows[0]
      const epochSec = Math.floor(g.startTs.getTime() / 1000)
      return {
        id: `grp-${epochSec}-pending`,
        type: 'api-recording' as const,
        timestamp: g.startTs.toISOString().replace('T', ' ').slice(0, 19),
        blockchainRecordedAt: g.startTs.toISOString(),
        txHash: rep.txHash || '',
        status: 'pending' as const, // 기록 트랜잭션 성격 유지
        blockNumber: rep.blockNumber ?? null,
        gasUsed: rep.gasUsed ?? null,
        gasPrice: null as any,
        apiRecording: {
          recordCount: g.rows.length,
          records: []
        }
      }
    })

    // 정렬(대표 시작 시각 desc) 후 페이징 (limit 절반 사용)
    const apiGroupsPaged = apiGroupsMapped
      .sort((a, b) => new Date(b.blockchainRecordedAt!).getTime() - new Date(a.blockchainRecordedAt!).getTime())
      .slice(Math.floor(offset / 2), Math.floor(offset / 2) + Math.floor(limit / 2))

    const txsSuccess = successGroups.map((r) => {
      const iso = r.grpIso?.endsWith('Z') ? r.grpIso : r.grpIso + 'Z'
      return {
        id: `grp-${r.epochSec}-successed`,
        type: 'token-distribution' as const,
        timestamp: iso,
        blockchainRecordedAt: iso,
        txHash: r.txHash || '',
        status: 'success' as const,
        blockNumber: r.blockNumber ?? null,
        gasUsed: r.gasUsed ?? null,
        gasPrice: null as any,
        tokenDistribution: {
          totalAmount: parseFloat(r.totalAmount.toString()),
          recipientCount: parseInt((r as any).uniqCnt?.toString?.() ?? r.cnt.toString()),
          recipients: []
        }
      }
    })

    const txsApi = apiGroupsPaged

    // 합치고 최신순 정렬
    const combined = [...txsSuccess, ...txsApi]
    // 정렬 규칙:
    // 1) blockchainRecordedAt (또는 timestamp) 최신순(desc)
    // 2) 같은 초(second) 단위일 경우 token-distribution 이 api-recording 보다 먼저
    combined.sort((a, b) => {
      const ta = new Date(a.blockchainRecordedAt || a.timestamp).getTime()
      const tb = new Date(b.blockchainRecordedAt || b.timestamp).getTime()
      if (tb !== ta) return tb - ta
      // 초 단위 비교
      const sa = Math.floor(ta / 1000)
      const sb = Math.floor(tb / 1000)
      if (sb !== sa) return sb - sa
      if (a.type === b.type) return 0
      if (a.type === 'token-distribution') return -1
      if (b.type === 'token-distribution') return 1
      return 0
    })
    return combined
  }

  // 트랜잭션 상세 조회
  async getTransactionDetail(id: string) {
    // 새 ID 포맷: grp-<epochSec>-<status>
    if (!id.startsWith('grp-')) return null
    const parts = id.split('-')
    const epochSec = parts[1]
    const status = parts[2]
    if (!epochSec || !status) return null

    if (status === 'successed') {
      // 초 단위 매칭 (토큰 분배)
      const result = await db
        .select({
          tsIso: sql<string>`to_char(date_trunc('second', ${rewards.blockchain_recorded_at}), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
          txHash: rewards.payout_tx_hash,
          blockNumber: rewards.block_number,
          gasUsed: rewards.gas_used,
          amount: rewards.amount,
          companyName: companies.name,
          companyId: rewards.company_id,
          musicId: rewards.music_id,
          playId: rewards.play_id,
          rewardCode: rewards.reward_code,
          usedAt: sql<string>`TO_CHAR(${rewards.created_at}, 'YYYY-MM-DD HH24:MI:SS')`
        })
        .from(rewards)
        .leftJoin(companies, sql`${companies.id} = ${rewards.company_id}`)
        .where(sql`
          ${rewards.payout_tx_hash} IS NOT NULL
          AND ${rewards.blockchain_recorded_at} IS NOT NULL
          AND ${rewards.status} = 'successed'
          AND EXTRACT(EPOCH FROM date_trunc('second', ${rewards.blockchain_recorded_at}))::bigint = ${sql.raw(epochSec)}::bigint
        `)
        .orderBy(rewards.created_at)

      if (result.length === 0) return null
      const first = result[0]
      const totalAmount = result.reduce((s, r) => s + parseFloat(r.amount.toString()), 0)
      // 기업별 집계: 고유 기업 수 및 총 수령량 계산
      const byCompany = new Map<number, { company: string; amount: number }>()
      for (const r of result) {
        const cid = Number(r.companyId)
        const curr = byCompany.get(cid)
        const amt = parseFloat(r.amount.toString())
        if (curr) {
          curr.amount += amt
        } else {
          byCompany.set(cid, { company: (r.companyName as any) ?? '', amount: amt })
        }
      }
      const recipientsAgg = Array.from(byCompany.values())
        .sort((a, b) => b.amount - a.amount)
      return {
        id,
        type: 'token-distribution' as const,
        timestamp: first.tsIso,
        blockchainRecordedAt: first.tsIso,
        txHash: first.txHash || '',
        status: 'success' as const,
        blockNumber: first.blockNumber,
        gasUsed: first.gasUsed,
        gasPrice: null,
        tokenDistribution: {
          totalAmount,
          recipientCount: recipientsAgg.length,
          recipients: recipientsAgg
        }
      }
    }

    // pending 그룹 상세: 시작 epochSec 기준 30초 범위
    const startEpoch = Number(epochSec)
    if (Number.isNaN(startEpoch)) return null
    const result = await db
      .select({
        ts: rewards.blockchain_recorded_at,
        txHash: rewards.payout_tx_hash,
        blockNumber: rewards.block_number,
        gasUsed: rewards.gas_used,
        amount: rewards.amount,
        companyName: companies.name,
        companyId: rewards.company_id,
        musicId: sql<string>`COALESCE(${rewards.music_id}, ${music_plays.music_id})::text`,
        musicTitle: sql<string>`m.title`,
        playId: rewards.play_id,
        useCase: music_plays.use_case,
        rewardCode: rewards.reward_code,
        usedAt: sql<string>`TO_CHAR(${rewards.created_at}, 'YYYY-MM-DD HH24:MI:SS')`
      })
      .from(rewards)
      .leftJoin(companies, sql`${companies.id} = ${rewards.company_id}`)
      .leftJoin(music_plays, sql`${music_plays.id} = ${rewards.play_id}`)
      .leftJoin(sql`musics m`, sql`m.id = COALESCE(${rewards.music_id}, ${music_plays.music_id})`)
      .where(sql`
        ${rewards.payout_tx_hash} IS NOT NULL
        AND ${rewards.blockchain_recorded_at} IS NOT NULL
        AND ${rewards.status} IN ('pending','successed')
  AND EXTRACT(EPOCH FROM ${rewards.blockchain_recorded_at}) >= ${startEpoch}
  AND EXTRACT(EPOCH FROM ${rewards.blockchain_recorded_at}) < ${startEpoch} + 30
      `)
      .orderBy(rewards.blockchain_recorded_at)

    if (result.length === 0) return null
    const first = result[0]
    const repTs = first.ts ? new Date(first.ts as any) : new Date(startEpoch * 1000)
    const repTsStr = repTs.toISOString().replace('T', ' ').slice(0, 19)
    return {
      id,
      type: 'api-recording' as const,
      timestamp: repTsStr,
      blockchainRecordedAt: repTs.toISOString(),
      txHash: first.txHash || '',
      status: 'pending' as const,
      blockNumber: first.blockNumber,
      gasUsed: first.gasUsed,
      gasPrice: null,
      apiRecording: {
        recordCount: result.length,
        records: result.map(r => ({
          companyId: Number(r.companyId),
          companyName: r.companyName,
          musicId: Number(r.musicId),
          musicTitle: r.musicTitle,
          playId: Number(r.playId),
          useCase: Number(r.useCase as any),
          rewardCode: Number(r.rewardCode as any),
          timestamp: r.usedAt
        }))
      }
    }
  }
}
