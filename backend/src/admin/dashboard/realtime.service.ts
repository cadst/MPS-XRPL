import { Injectable } from '@nestjs/common'
import { db } from '../../db/client'
import { buildRecentApiCallsQuery, buildTopTracksQuery } from './queries/realtime.queries'

@Injectable()
export class RealtimeService {
  async getRealtimeData() {
    try {
      // 최근 5분간의 API 호출 데이터
      const apiCalls = await this.getRecentApiCalls()
      
      // 최근 24시간 인기 음원 TOP 10
      const topTracks = await this.getTopTracks()

      return {
        apiCalls,
        topTracks,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('실시간 데이터 조회 실패:', error)
      throw error
    }
  }

  private async getRecentApiCalls() {
    const query = buildRecentApiCallsQuery()
    const result = await db.execute(query)
    return result.rows.map((row: any) => ({
      id: row.id,
      musicId: row.music_id ? Number(row.music_id) : undefined,
      status: row.status,
      endpoint: row.endpoint,
      callType: row.call_type,
      validity: row.validity,
      company: row.company || '알 수 없음',
      musicTitle: row.music_title || undefined,
      timestamp: row.created_at ? new Date(row.created_at).toLocaleTimeString('ko-KR') : '00:00:00'
    }))
  }

  private async getTopTracks() {
    const query = buildTopTracksQuery()
    const result = await db.execute(query)
    return result.rows.map((row: any) => ({
      id: row.id,
      rank: Number(row.rank),
      title: row.title,
      validPlays: Number(row.valid_plays)
    }))
  }
}
