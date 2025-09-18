// apps/backend/src/client/explore/explore.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type {
  ExploreSectionsDto,
  ExploreSectionDto,
  ExploreTrackDto,
} from './dto/explore.dto';

type Grade = 'free' | 'standard' | 'business';

function toBool(v: any): boolean {
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
      -- 같은 달 중복행 방지: 곡별 1행으로 집계
      mm AS (
        SELECT
          music_id,
          SUM(total_reward_count)::int     AS total_reward_count,
          SUM(remaining_reward_count)::int AS remaining_reward_count,
          MAX(reward_per_play)             AS reward_per_play
        FROM monthly_music_rewards
        WHERE year_month = to_char(now(), 'YYYY-MM')
        GROUP BY music_id
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
        m.category_id,
        c.name AS category_name,
        m.inst,
        (m.lyrics_text IS NOT NULL OR m.lyrics_file_path IS NOT NULL) AS has_lyrics_raw,
        m."grade_required" AS grade_required,
        m.price_per_play,                                
        -- 참고용(can_use_sql)
        CASE WHEN (SELECT lvl FROM my) = 0 THEN (m."grade_required" = 0) ELSE TRUE END AS can_use_sql,

        mm.reward_per_play,
        mm.total_reward_count,
        mm.remaining_reward_count,
        (mm.total_reward_count * mm.reward_per_play)     AS reward_total,
        (mm.remaining_reward_count * mm.reward_per_play) AS reward_remain,
        COALESCE(pop.recent_valid_plays, 0)              AS popularity,
        m.created_at
      FROM musics m
      LEFT JOIN mm  ON mm.music_id  = m.id
      LEFT JOIN pop ON pop.music_id = m.id
      LEFT JOIN music_categories c ON c.id = m.category_id  
      ORDER BY popularity DESC, m.created_at DESC
      LIMIT 60
    `);

    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);

    const list: ExploreTrackDto[] = rows.map((r: any): ExploreTrackDto => {
      const required = Number(r.grade_required) as 0 | 1 | 2;
      const isFree = required === 0;
      const isUpgraded = grade === 'standard' || grade === 'business';

      // 접근 정책
      const gradePass = isFree ? true : isUpgraded;
      const canUse = !!isAuth && gradePass;
      const locked = !isAuth || (!isFree && !isUpgraded);
      const reason: ExploreTrackDto['reason'] =
        !isAuth ? 'LOGIN_REQUIRED' : (gradePass ? 'OK' : 'SUBSCRIPTION_REQUIRED');

      // 리워드 분류/활성 (grade=1인 리워드 트랙일 때만 숫자 살림)
      const reward_total_count = Number(r.total_reward_count ?? 0);
      const reward_remain_count = Number(r.remaining_reward_count ?? 0);
      const reward_one_raw = r.reward_per_play;
      const reward_type: ExploreTrackDto['reward_type'] =
        required === 1 && reward_one_raw != null && reward_total_count > 0
          ? 'REWARD'
          : 'NO_REWARD';
      const reward_active = reward_type === 'REWARD' && reward_remain_count > 0;

      // 숫자 출력: REWARD일 때만, 아니면 전부 null
      const reward_one_out    = reward_type === 'REWARD' ? Number(r.reward_per_play) : null;
      const reward_total_out  = reward_type === 'REWARD' && r.reward_total  != null ? Number(r.reward_total)  : null;
      const reward_remain_out = reward_type === 'REWARD' && r.reward_remain != null ? Number(r.reward_remain) : null;
      const total_count_out   = reward_type === 'REWARD' && Number.isFinite(reward_total_count)  ? reward_total_count  : null;
      const remain_count_out  = reward_type === 'REWARD' && Number.isFinite(reward_remain_count) ? reward_remain_count : null;

      const inst = toBool(r.inst);
      const hasLyricsRaw = toBool(r.has_lyrics_raw);
      const pricePerPlay = r.price_per_play != null ? Number(r.price_per_play) : null; // ✅ 재생가

      return {
        id: Number(r.id),
        title: r.title,
        artist: r.artist ?? null,
        cover_image_url: r.cover_image_url ?? null,

        // Inst / Full 표시는 여기서 이미 내려갑니다
        format: inst ? 'INSTRUMENTAL' : 'FULL',
        has_lyrics: hasLyricsRaw && !inst,
        category_id: r.category_id ?? null,
        category_name: r.category_name ?? null,
        grade_required: required,
        access_type: isFree ? 'FREE' : 'SUBSCRIPTION',
        can_use: canUse,
        locked,
        reason,
        price_per_play: pricePerPlay,               
        reward: {
          reward_one:   reward_one_out,
          reward_total: reward_total_out,
          reward_remain: reward_remain_out,
          total_count:  total_count_out as any,
          remain_count: remain_count_out as any,
        },
        reward_type,
        reward_active,

        popularity: Number(r.popularity ?? 0),
        created_at: r.created_at,
      };
    });

    // 섹션
    const featured: ExploreSectionDto = {
      key: 'featured',
      title: '추천',
      items: list.slice(0, 3),
    };

    const news = {
      key: 'news',
      title: '새로 올라온 곡',
      items: [...list]
        .sort((a, b) => +new Date(b.created_at as any) - +new Date(a.created_at as any))
        .slice(0, 12),
    } as const satisfies ExploreSectionDto;

    const charts = {
      key: 'charts',
      title: '차트 Charts',
      items: [...list]
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, 12),
    } as const satisfies ExploreSectionDto;

    const moods = {
      key: 'moods',
      title: '무드 & 장르',
      items: list.slice(0, 12),
    } as const satisfies ExploreSectionDto;

    return { featured, news, charts, moods };
  }
}
