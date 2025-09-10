// apps/backend/src/client/musics/musics.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ListMusicQueryDto } from './dto/list-music.query.dto';
import { PopularMusicDto } from './dto/popular-music.dto';
import { CategoryDto } from './dto/category.dto';
import { MusicDetailDto, UseMusicResponseDto } from './dto/music-detail.dto';

type Grade = 'free'|'standard'|'business';
const toBool = (v:any) => v===true || v==='t' || v==='T' || v===1 || v==='1';

@Injectable()
export class MusicsService {
  constructor(@Inject('DB') private readonly db: any) {}

  async searchList(params: {
    companyId: number; grade: Grade; isAuth: boolean; query: ListMusicQueryDto
  }): Promise<{items: PopularMusicDto[]; nextCursor: string|null}> {
    const { grade, isAuth, query } = params;
    const limit = query.limit ?? 20;

    // 커서 복호화 (newest 전용: created_at, id)
    let cursorCreatedAt: string|undefined;
    let cursorId: number|undefined;
    if (query.cursor && (query.sort === 'newest' || !query.sort)) {
      try {
        const parsed = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
        cursorCreatedAt = parsed.ca; cursorId = parsed.id;
      } catch {}
    }

    const wheres = [sql`1=1`];

    if (query.q && (query.mode === 'keyword' || !query.mode)) {
      wheres.push(sql`(m.title ILIKE ${'%' + query.q + '%'} OR m.artist ILIKE ${'%' + query.q + '%'})`);
    }

    if (query.category_id !== undefined && query.category_id !== null && query.category_id !== '') {
      const n = Number(query.category_id);
      if (Number.isFinite(n)) {
        wheres.push(sql`m.category_id = ${n}`);
      }
    }

    // (선택) 리워드 필터
    if (query.reward_max != null) {
      wheres.push(sql`mm.reward_per_play <= ${query.reward_max}`);
    }
    if (query.remaining_reward_max != null) {
      wheres.push(sql`(mm.remaining_reward_count * mm.reward_per_play) <= ${query.remaining_reward_max}`);
    }

    // 정렬키
    const days = 30;
    const sort = query.sort ?? 'newest';
    const orderBy =
      sort === 'newest'
        ? sql`m.created_at DESC, m.id DESC`
        : sort === 'most_played'
        ? sql`COALESCE(pop.recent_valid_plays,0) DESC, m.created_at DESC, m.id DESC`
        : sort === 'remaining_reward'
        ? sql`(mm.remaining_reward_count * mm.reward_per_play) DESC NULLS LAST, m.created_at DESC, m.id DESC`
        : // relevance(fallback) → 간단히 인기+최신
          sql`COALESCE(pop.recent_valid_plays,0) DESC, m.created_at DESC, m.id DESC`;

    // 커서 조건: 지금은 newest일 때만 정확히 적용 (다른 정렬은 created_at 기반이라 부정확해질 수 있으니 비활성화)
    if ((query.sort === 'newest' || !query.sort) && cursorCreatedAt && cursorId) {
      wheres.push(sql`(m.created_at, m.id) < (${cursorCreatedAt}::timestamptz, ${cursorId})`);
    }

    const result: any = await this.db.execute(sql`
      WITH my AS (
        SELECT CASE ${grade}::text
          WHEN 'free' THEN 0
          WHEN 'standard' THEN 1
          WHEN 'business' THEN 2
          ELSE 0
        END AS lvl
      ),
      mm AS (
        SELECT music_id, total_reward_count, remaining_reward_count, reward_per_play
        FROM monthly_music_rewards
        WHERE year_month = to_char(now(), 'YYYY-MM')
      ),
      pop AS (
        SELECT music_id, COUNT(*)::int AS recent_valid_plays
        FROM music_plays
        WHERE is_valid_play = true
          AND created_at >= now() - (${days} || ' days')::interval
        GROUP BY music_id
      )
      SELECT
        m.id,
        m.title,
        m.artist,
        m.cover_image_url,
        m.inst,
        (m.lyrics_text IS NOT NULL OR m.lyrics_file_path IS NOT NULL) AS has_lyrics_raw,
        m.grade_required,
        CASE WHEN (SELECT lvl FROM my) = 0 THEN (m.grade_required = 0) ELSE TRUE END AS can_use_sql,
        m.category_id,  -- 필요하면 dto에 category_id로 반영
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
      WHERE ${sql.join(wheres, sql` AND `)}
      ORDER BY ${orderBy}
      LIMIT ${limit + 1}
    `);

    const rows: any[] = Array.isArray(result) ? result : (result?.rows ?? []);
    const items = rows.slice(0, limit).map((r) => {
      const required = Number(r.grade_required) as 0|1|2;
      const gradePass = required === 0 ? true : (grade !== 'free');
      const canUse = !!isAuth && gradePass;
      const inst = toBool(r.inst);
      const hasLyricsRaw = toBool(r.has_lyrics_raw);

      const dto: PopularMusicDto = {
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
        // 필요하면 PopularMusicDto에 아래 필드를 추가해서 타입도 맞춰 주세요.
        // category_id: r.category_id ?? null,
      };
      return dto;
    });

    const hasMore = rows.length > limit;
    let nextCursor: string | null = null;

    if ((query.sort === 'newest' || !query.sort) && hasMore && items.length) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ ca: last.created_at, id: last.id }), 'utf8').toString('base64url');
    }
    // most_played / remaining_reward는 커서키 확장 후 적용 권장 (popularity 또는 reward_remain 값을 커서에 포함해 3중 비교)

    return { items, nextCursor };
  }

  async listCategories(): Promise<CategoryDto[]> {
    // (1) categories 테이블이 있으면 그걸 사용
    try {
      const res: any = await this.db.execute(sql`
        SELECT c.id AS category_id, c.name AS category_name
        FROM categories c
        ORDER BY c.name ASC, c.id ASC
      `);
      const rows: any[] = Array.isArray(res) ? res : (res?.rows ?? []);
      return rows.map((r) => ({
        category_id: Number(r.category_id),
        category_name: String(r.category_name ?? ''),
      }));
    } catch {
      // (2) fallback: musics.category_id만 있을 때
      try {
        const res2: any = await this.db.execute(sql`
          SELECT DISTINCT m.category_id AS category_id
          FROM musics m
          WHERE m.category_id IS NOT NULL
          ORDER BY m.category_id ASC
        `);
        const rows2: any[] = Array.isArray(res2) ? res2 : (res2?.rows ?? []);
        return rows2.map((r) => ({
          category_id: Number(r.category_id),
          category_name: String(r.category_id), // 이름 없으면 id 문자열로 표시
        }));
      } catch {
        return [];
      }
    }
    
  }
  async getDetail(params: {
    companyId: number;
    grade: Grade;
    isAuth: boolean;
    musicId: number;
  }): Promise<MusicDetailDto> {
    const { companyId, grade, isAuth, musicId } = params;
    const days = 30;

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
        SELECT music_id, total_reward_count, remaining_reward_count, reward_per_play
        FROM monthly_music_rewards
        WHERE year_month = to_char(now(), 'YYYY-MM')
      ),
      pop AS (
        SELECT music_id, COUNT(*)::int AS recent_valid_plays
        FROM music_plays
        WHERE is_valid_play = true
          AND created_at >= now() - (${days} || ' days')::interval
        GROUP BY music_id
      )
      SELECT
        m.id, m.title, m.artist, m.cover_image_url, m.inst,
        (m.lyrics_text IS NOT NULL OR m.lyrics_file_path IS NOT NULL) AS has_lyrics_raw,
        m.lyrics_text, m.lyrics_file_path,
        m.grade_required,
        CASE WHEN (SELECT lvl FROM my) = 0 THEN (m.grade_required = 0) ELSE TRUE END AS can_use_sql,
        m.category_id, c.name AS category_name,
        m.duration_sec, m.price_per_play,
        mm.reward_per_play, mm.total_reward_count, mm.remaining_reward_count,
        (mm.total_reward_count * mm.reward_per_play)     AS reward_total,
        (mm.remaining_reward_count * mm.reward_per_play) AS reward_remain,
        COALESCE(pop.recent_valid_plays,0)               AS popularity,
        m.created_at,
        (cm.id IS NOT NULL)                              AS is_using
      FROM musics m
      LEFT JOIN mm  ON mm.music_id  = m.id
      LEFT JOIN pop ON pop.music_id = m.id
      LEFT JOIN music_categories c ON c.id = m.category_id
      LEFT JOIN company_musics cm
        ON cm.music_id = m.id AND cm.company_id = ${companyId}
      WHERE m.id = ${musicId}
      LIMIT 1
    `);

    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (!row) throw new Error('Music not found');

    const required = Number(row.grade_required) as 0 | 1 | 2;
    const gradePass = required === 0 ? true : (grade !== 'free');
    const canUse = !!isAuth && gradePass;

    const inst = toBool(row.inst);
    const hasLyricsRaw = toBool(row.has_lyrics_raw);

    const dto: MusicDetailDto = {
      id: Number(row.id),
      title: row.title,
      artist: row.artist,
      cover_image_url: row.cover_image_url ?? null,
      format: inst ? 'INSTRUMENTAL' : 'FULL',
      has_lyrics: hasLyricsRaw && !inst,
      lyrics_text: row.lyrics_text ?? null,
      lyrics_file_path: row.lyrics_file_path ?? null,
      grade_required: required,
      can_use: canUse,
      reward: {
        reward_one: row.reward_per_play ?? null,
        reward_total: row.reward_total ?? null,
        reward_remain: row.reward_remain ?? null,
        total_count: row.total_reward_count ?? null,
        remain_count: row.remaining_reward_count ?? null,
      },
      popularity: Number(row.popularity ?? 0),
      created_at: row.created_at,
      category_id: row.category_id ?? null,
      category_name: row.category_name ?? null,
      duration_sec: row.duration_sec ?? null,
      price_per_play: row.price_per_play ?? null,
      is_using: !!row.is_using,
    };

    return dto;
  }

  async useMusic(companyId: number, musicId: number): Promise<UseMusicResponseDto> {
    // 이미 사용중?
    const found: any = await this.db.execute(sql`
      SELECT id
      FROM company_musics
      WHERE company_id = ${companyId} AND music_id = ${musicId}
      LIMIT 1
    `);
    const one = Array.isArray(found) ? found[0] : found?.rows?.[0];
    if (one?.id) {
      return { using_id: Number(one.id), is_using: true };
    }

    // 새로 생성 (UNIQUE(company_id, music_id) 인덱스 전제)
    const ins: any = await this.db.execute(sql`
      INSERT INTO company_musics (company_id, music_id)
      VALUES (${companyId}, ${musicId})
      RETURNING id
    `);
    const row = Array.isArray(ins) ? ins[0] : ins?.rows?.[0];
    return { using_id: Number(row.id), is_using: true };
  }
}
