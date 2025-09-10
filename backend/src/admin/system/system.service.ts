import { Injectable } from '@nestjs/common'
import { SystemStatsDto, SystemChartDto, SystemKeysDto } from './dto/system.dto'
import { buildApiStatsQuery, buildApiChartQuery, buildApiKeysQuery } from './queries/system.queries'
import { db } from '../../db/client'

@Injectable()
export class SystemService {
  async getApiStats(dto: SystemStatsDto) {
    const query = buildApiStatsQuery(dto.period || '24h')
    const result = await db.execute(query)
    
    const stats = result.rows[0] as any
    
    return {
      musicCalls: Number(stats.music_calls || 0),
      lyricsCalls: Number(stats.lyrics_calls || 0),
      totalCalls: Number(stats.total_calls || 0),
      activeApiKeys: Number(stats.active_api_keys || 0),
      musicCallsChange: Number(stats.music_calls_change || 0),
      lyricsCallsChange: Number(stats.lyrics_calls_change || 0),
      totalCallsChange: Number(stats.total_calls_change || 0),
      activeApiKeysChange: Number(stats.active_api_keys_change || 0)
    }
  }

  async getApiChart(dto: SystemChartDto) {
    const query = buildApiChartQuery(dto.period || '24h')
    const result = await db.execute(query)
    
    const data = result.rows as any[]
    
    return {
      labels: data.map(row => row.label),
      freeCalls: data.map(row => Number(row.free_calls || 0)),
      standardCalls: data.map(row => Number(row.standard_calls || 0)),
      businessCalls: data.map(row => Number(row.business_calls || 0)),
      musicCalls: data.map(row => Number(row.music_calls || 0)),
      lyricsCalls: data.map(row => Number(row.lyrics_calls || 0))
    }
  }

  async getApiKeys(dto: SystemKeysDto) {
    const query = buildApiKeysQuery(dto)
    const result = await db.execute(query)
    
    const data = result.rows as any[]
    
    return data.map(row => ({
      companyId: row.company_id,
      company: row.company_name,
      key: row.api_key,
      created: row.created_at,
      lastUsed: row.last_used,
      totalCalls: Number(row.total_calls || 0),
      musicCalls: Number(row.music_calls || 0),
      lyricsCalls: Number(row.lyrics_calls || 0)
    }))
  }
}
