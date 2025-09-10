// apps/backend/src/client/explore/explore.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { ExploreSectionsDto, ExploreTrackDto } from './dto/explore.dto';

type Grade = 'free' | 'standard' | 'business';

function toBool(v: any): boolean {
  // pg에서 't'/'f' 또는 1/0으로 오는 케이스 방지
  return v === true || v === 't' || v === 'T' || v === 1 || v === '1';
}

@Injectable()
export class ExploreService {
  constructor(@Inject('DB') private readonly db: any) {}

  async getSections(
    companyId: number,
    grade: Grade,
    isAuth: boolean,
  ): Promise<ExploreSectionsDto> {
    const result: any = await this.db.execute(sql`
      WITH my AS (
        SELECT CASE
          WHEN ${grade}::text = 'free' THEN 0
          WHEN ${grade}::text = 'standard' THEN 1
          WHEN ${grade}::text = 'business' THEN 2
          ELSE 0
        END AS lvl
      ),
      mm AS (
        SELECT
          music_id,
          total_reward_count,
          remaining_reward_count,
          reward_per_play
        FROM monthly_music_rewards
        WHERE year_month = to_char(now(), 'YYYY-MM')
      ),
      pop AS (
        SELECT music_id, COUNT(*)::int AS recent_valid_plays
        FROM music_plays
        WHERE is_valid_play = true
          AND created_at >= now() - interval '30 days'
        GROUP BY music_id
      )
      SELECT
        m.id,
        m.title,
        m.artist,
        m.cover_image_url,
        m.inst,
        (m.lyrics_text IS NOT NULL OR m.lyrics_file_path IS NOT NULL) AS has_lyrics_raw,
        m."grade_required" AS grade_required,
          CASE WHEN (SELECT lvl FROM my) = 0 THEN (m."grade_required" = 0) ELSE TRUE END AS can_use_sql,
        mm.reward_per_play,
        mm.total_reward_count,
        mm.remaining_reward_count,
        (mm.total_reward_count * mm.reward_per_play)       AS reward_total,
        (mm.remaining_reward_count * mm.reward_per_play)   AS reward_remain,
        COALESCE(pop.recent_valid_plays, 0)                AS popularity,
        m.created_at
      FROM musics m
      LEFT JOIN mm  ON mm.music_id  = m.id
      LEFT JOIN pop ON pop.music_id = m.id
      ORDER BY popularity DESC, m.created_at DESC
      LIMIT 60
    `);

    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    if (!Array.isArray(rows)) {
      throw new Error('Unexpected DB result shape from db.execute(sql`...`)');
    }

    const list: ExploreTrackDto[] = rows.map((r: any) => {
      const required = Number(r.grade_required) as 0 | 1 | 2;

      // 등급 통과 여부(standard/business면 구독 트랙 사용 가능)
      const gradePass = required === 0 ? true : (grade === 'standard' || grade === 'business');

      // 게스트는 액션 불가 → 최종 can_use는 로그인 + 등급 모두 통과해야 true
      const canUse = !!isAuth && gradePass;

      const inst = toBool(r.inst);
      const hasLyricsRaw = toBool(r.has_lyrics_raw);

      // 잠금 사유를 프론트에서 분기하고 싶다면 access 블록을 함께 내려도 OK
      const reason: 'OK' | 'LOGIN_REQUIRED' | 'SUBSCRIPTION_REQUIRED' =
        !isAuth ? 'LOGIN_REQUIRED' : (gradePass ? 'OK' : 'SUBSCRIPTION_REQUIRED');

      return {
        id: Number(r.id),
        title: r.title,
        artist: r.artist,
        cover_image_url: r.cover_image_url ?? null,
        format: inst ? 'INSTRUMENTAL' : 'FULL',
        has_lyrics: hasLyricsRaw && !inst,
        grade_required: required,
        can_use: canUse,
        reward: {
          reward_one: r.reward_per_play ?? null,
          reward_total: r.reward_total ?? null,
          reward_remain: r.reward_remain ?? null,
          total_count: r.total_reward_count ?? null,
          remain_count: r.remaining_reward_count ?? null,
        },
        popularity: Number(r.popularity ?? 0),
        created_at: r.created_at,
        // DTO에 access 필드가 있다면 주석 해제해서 같이 내려주세요.
        // access: {
        //   is_guest: !isAuth,
        //   requires_login: !isAuth,
        //   can_use: canUse,
        //   reason,
        // },
      } as ExploreTrackDto;
    });

    const featured = list.slice(0, 3);
    const news = {
      key: 'news',
      title: '새로 올라온 곡',
      items: [...list]
        .sort((a, b) => +new Date(b.created_at as any) - +new Date(a.created_at as any))
        .slice(0, 12),
    };
    const charts = {
      key: 'charts',
      title: '차트 Charts',
      items: [...list]
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, 12),
    };
    const moods = {
      key: 'moods',
      title: '무드 & 장르',
      items: list.slice(0, 12),
    };

    return { featured, news, charts, moods };
  }
}
