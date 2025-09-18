// apps/backend/src/client/musics/musics.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import {
  ListMusicQueryDto,
  NormalizedListQuery,
  normalizeListQuery
} from './dto/list-music.query.dto';  
import { PopularMusicDto } from './dto/popular-music.dto';
import { CategoryDto } from './dto/category.dto';
import { MusicDetailDto, UseMusicResponseDto } from './dto/music-detail.dto';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { music_tags, raw_tags } from "../../db/schema";

const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? path.join(process.cwd(), 'uploads');

type Grade = 'free'|'standard'|'business';
const toBool = (v:any) => v===true || v==='t' || v==='T' || v===1 || v==='1';

function isNormalized(q: any): q is NormalizedListQuery {
  return typeof q?.explain === 'boolean';
}


@Injectable()
export class MusicsService {
  constructor(@Inject('DB') private readonly db: any) {}


async searchList(params: {
  companyId: number; grade: Grade; isAuth: boolean;
  query: ListMusicQueryDto | NormalizedListQuery
}): Promise<{items: PopularMusicDto[]; nextCursor: string|null}> {
  const { grade, isAuth } = params;

  const qnorm: NormalizedListQuery = isNormalized(params.query)
    ? params.query
    : normalizeListQuery(params.query);

  const limit = qnorm.limit ?? 20;

  // 커서 (newest 전용)
  let cursorCreatedAt: string|undefined;
  let cursorId: number|undefined;
  if (qnorm.cursor && (qnorm.sort === 'newest' || !qnorm.sort)) {
    try {
      const parsed = JSON.parse(Buffer.from(qnorm.cursor, 'base64url').toString('utf8'));
      cursorCreatedAt = parsed.ca; cursorId = parsed.id;
    } catch {}
  }

  const wheres = [sql`1=1`];

  // 검색어 (keyword 모드만 우선)
  if (qnorm.q && (qnorm.mode === 'keyword' || !qnorm.mode)) {
    wheres.push(sql`(m.title ILIKE ${'%' + qnorm.q + '%'} OR m.artist ILIKE ${'%' + qnorm.q + '%'})`);
  }

  if (Array.isArray(qnorm.categories) && qnorm.categories.length) {
    const catIds = qnorm.categories.map((v) => Number(v)).filter(Number.isFinite);
    if (catIds.length) {
      const catArr =
        catIds.length > 0
          ? sql`ARRAY[${sql.join(catIds, sql`, `)}]::bigint[]`
          : sql`ARRAY[]::bigint[]`;
      wheres.push(sql`m.category_id = ANY(${catArr})`);
    }
  }

  if (Array.isArray(qnorm.formatsDb) && qnorm.formatsDb.length && qnorm.formatsDb.length !== 2) {
    if (qnorm.formatsDb.includes('INSTRUMENTAL')) {
      wheres.push(sql`m.inst = true`);
    } else if (qnorm.formatsDb.includes('FULL')) {
      wheres.push(sql`m.inst = false`);
    }
  }

  if (Array.isArray(qnorm.moodsLower) && qnorm.moodsLower.length) {
    const moodArr =
      qnorm.moodsLower.length > 0
        ? sql`ARRAY[${sql.join(qnorm.moodsLower.map((s) => sql`${s}`), sql`, `)}]::text[]`
        : sql`ARRAY[]::text[]`;
    wheres.push(sql`
      EXISTS (
        SELECT 1
        FROM music_tags mt
        LEFT JOIN raw_tags rt ON rt.id = mt.raw_tag_id
        WHERE mt.music_id = m.id
          AND (
            LOWER(mt.text) = ANY(${moodArr})
            OR LOWER(rt.name) = ANY(${moodArr})
          )
          AND (rt.type IS NULL OR rt.type = 'mood')
      )
    `);
  }

  // 리워드 필터
  if (qnorm.rewardMax != null) {
    wheres.push(sql`mm.reward_per_play <= ${qnorm.rewardMax}`);
  }
  if (qnorm.remainingRewardMax != null) {
    wheres.push(sql`(mm.remaining_reward_count * mm.reward_per_play) <= ${qnorm.remainingRewardMax}`);
  }

  // 정렬키
  const sort = qnorm.sort ?? 'newest';
  const orderBy =
    sort === 'newest'
      ? sql`m.created_at DESC, m.id DESC`
      : sort === 'most_played'
      ? sql`COALESCE(pop.recent_valid_plays,0) DESC, m.created_at DESC, m.id DESC`
      : sort === 'remaining_reward'
      ? sql`(mm.remaining_reward_count * mm.reward_per_play) DESC NULLS LAST, m.created_at DESC, m.id DESC`
      : sort === 'total_reward'
      ? sql`(mm.total_reward_count * mm.reward_per_play) DESC NULLS LAST, m.created_at DESC, m.id DESC`
      : sort === 'reward_one'
      ? sql`mm.reward_per_play DESC NULLS LAST, m.created_at DESC, m.id DESC`
      : // relevance(fallback) → 인기+최신
        sql`COALESCE(pop.recent_valid_plays,0) DESC, m.created_at DESC, m.id DESC`;

  // 커서 조건 (newest)
  if ((qnorm.sort === 'newest' || !qnorm.sort) && cursorCreatedAt && cursorId) {
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
      SELECT music_id, SUM(total_reward_count)::int AS total_reward_count,
             SUM(remaining_reward_count)::int AS remaining_reward_count,
             MAX(reward_per_play) AS reward_per_play
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
      m.inst,
      (m.lyrics_text IS NOT NULL OR m.lyrics_file_path IS NOT NULL) AS has_lyrics_raw,
      m.grade_required,
      CASE WHEN (SELECT lvl FROM my) = 0 THEN (m.grade_required = 0) ELSE TRUE END AS can_use_sql,

      m.category_id,
      c.name AS category_name,

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
      category_id: r.category_id == null ? null : Number(r.category_id),
      category_name: r.category_name ?? null,
    };
    return dto;
  });

  const hasMore = rows.length > limit;
  let nextCursor: string | null = null;

  if ((qnorm.sort === 'newest' || !qnorm.sort) && hasMore && items.length) {
    const last = items[items.length - 1];
    nextCursor = Buffer.from(JSON.stringify({ ca: last.created_at, id: last.id }), 'utf8').toString('base64url');
  }

  return { items, nextCursor };
}


  async listCategories(): Promise<CategoryDto[]> {
    // (1) categories 테이블이 있으면 그걸 사용
    try {
      const res: any = await this.db.execute(sql`
         SELECT c.id AS category_id, c.name AS category_name
         FROM music_categories c
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
          SELECT
            music_id,
            SUM(total_reward_count)::int       AS total_reward_count,
            SUM(remaining_reward_count)::int   AS remaining_reward_count,
            MAX(reward_per_play)               AS reward_per_play
          FROM monthly_music_rewards
          WHERE year_month = to_char(now(), 'YYYY-MM')
          GROUP BY music_id
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
        (cm.id IS NOT NULL)                              AS is_using,
        m.lyrics_download_count                          AS lyrics_download_count                
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
      lyrics_download_count: Number(row.lyrics_download_count ?? 0),
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
  async getLyricsText(params: {
  companyId: number;
  grade: Grade;
  isAuth: boolean;
  musicId: number;
}): Promise<{ text: string; title: string; artist: string; filename: string }> {
  const { companyId, grade, isAuth, musicId } = params;

  // 로그인 필요 정책 유지
  if (!isAuth) throw new Error('LOGIN_REQUIRED');

  const q: any = await this.db.execute(sql`
    SELECT
      m.id, m.title, m.artist,
      m.inst,
      (m.lyrics_text IS NOT NULL OR m.lyrics_file_path IS NOT NULL) AS has_lyrics_raw,
      m.lyrics_text, m.lyrics_file_path,
      m.grade_required
    FROM musics m
    WHERE m.id = ${musicId}
    LIMIT 1
  `);
  const row = Array.isArray(q) ? q[0] : q?.rows?.[0];
  if (!row) throw new Error('NOT_FOUND');

  const required = Number(row.grade_required) as 0|1|2;
  const gradePass = required === 0 ? true : (grade !== 'free');
  if (!gradePass) throw new Error('SUBSCRIPTION_REQUIRED');

  const hasLyrics = (row.lyrics_text != null && row.lyrics_text !== '') || (row.lyrics_file_path != null && row.lyrics_file_path !== '');
  const isInst = toBool(row.inst);
  if (!hasLyrics || isInst) {
    // 인스트/가사 없음이면 제공 X
    throw new Error('NO_LYRICS');
  }

  let text = String(row.lyrics_text ?? '');
  if (!text && row.lyrics_file_path) {
    const abs = path.isAbsolute(row.lyrics_file_path)
      ? row.lyrics_file_path
      : path.join(UPLOAD_ROOT, 'lyrics', row.lyrics_file_path);
    try {
      text = await fs.readFile(abs, 'utf8');
    } catch {
      text = '';
    }
  }
  if (!text) throw new Error('NO_LYRICS');

  // 파일명 안전하게
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').trim();
  const filename = `${safe(row.title)}_${safe(row.artist || 'unknown')}.txt`;

  return { text, title: row.title, artist: row.artist, filename };
}

// 다운로드 카운트 + 텍스트 반환
async downloadLyricsAndCount(params: {
  companyId: number;
  grade: Grade;
  isAuth: boolean;
  musicId: number;
}): Promise<{ text: string; filename: string }> {
  const { text, filename } = await this.getLyricsText(params);

  // 카운트 증가 (null 안전)
  await this.db.execute(sql`
    UPDATE musics
       SET lyrics_download_count = COALESCE(lyrics_download_count, 0) + 1
     WHERE id = ${params.musicId}
  `);

  return { text, filename };
}
async getMusicTags(musicId: number) {
  const res: any = await this.db.execute(sql`
    SELECT
      mt.id,
      mt.text,
      mt.raw_tag_id,
      rt.name AS canonical_name,
      rt.slug AS canonical_slug,
      rt.type AS canonical_type
    FROM "music_tags" AS mt
    LEFT JOIN "raw_tags" AS rt ON rt.id = mt."raw_tag_id"
    WHERE mt."music_id" = ${musicId}
    ORDER BY mt.id ASC
  `);
  const rows: any[] = Array.isArray(res) ? res : (res?.rows ?? []);
  return rows.map(r => ({
    id: Number(r.id),
    text: String(r.text),
    raw_tag_id: r.raw_tag_id == null ? null : Number(r.raw_tag_id),
    canonical_name: r.canonical_name ?? null,   // 정규화 라벨(있으면 칩 라벨로)
    canonical_slug: r.canonical_slug ?? null,
    canonical_type: (r.canonical_type ?? null) as ("mood"|"genre"|"context"|null),
  }));
}
// 정규 태그 칩(무드/장르/컨텍스트) 목록
async listRawTagChips(type: 'mood'|'genre'|'context') {
  const res: any = await this.db.execute(sql`
    SELECT
      rt.id,
      rt.name,
      rt.slug,
      rt.type,
      COUNT(mt.id)::int AS mapped_count
    FROM "raw_tags" AS rt
    LEFT JOIN "music_tags" AS mt
      ON mt."raw_tag_id" = rt.id
    WHERE rt.type = ${type}
    GROUP BY rt.id, rt.name, rt.slug, rt.type
    ORDER BY rt.name ASC, rt.id ASC
  `);

  const rows: any[] = Array.isArray(res) ? res : (res?.rows ?? []);
  return rows.map(r => ({
    id: Number(r.id),
    name: String(r.name),
    slug: String(r.slug),
    type: r.type as ('mood'|'genre'|'context'),
    mapped_count: Number(r.mapped_count ?? 0),
  }));
}

// 여러 곡 태그 배치 조회 (카드 목록용)
async getTagsBulk(ids: number[]) {
  if (!ids?.length) return [];

  // ANY(ARRAY[...]) 형태로 안전하게 바인딩
  const arrSql =
    ids.length > 0
      ? sql`ARRAY[${sql.join(ids, sql`, `)}]::bigint[]`
      : sql`ARRAY[]::bigint[]`;

  const res: any = await this.db.execute(sql`
    SELECT
      mt."music_id",
      json_agg(
        json_build_object(
          'id', mt.id,
          'text', mt.text,
          'raw_tag_id', mt.raw_tag_id,
          'canonical_name', rt.name,
          'canonical_slug', rt.slug,
          'canonical_type', rt.type
        )
        ORDER BY mt.id
      ) AS tags
    FROM "music_tags" AS mt
    LEFT JOIN "raw_tags" AS rt
      ON rt.id = mt."raw_tag_id"
    WHERE mt."music_id" = ANY(${arrSql})
    GROUP BY mt."music_id"
    ORDER BY mt."music_id" ASC
  `);

  const rows: any[] = Array.isArray(res) ? res : (res?.rows ?? []);
  // 컨트롤러에서 그대로 리턴해도 되고, 맵으로 바꿔도 OK
  return rows.map(r => ({
    music_id: Number(r.music_id),
    tags: (r.tags ?? []).map((t: any) => ({
      id: Number(t.id),
      text: String(t.text),
      raw_tag_id: t.raw_tag_id == null ? null : Number(t.raw_tag_id),
      canonical_name: t.canonical_name ?? null,
      canonical_slug: t.canonical_slug ?? null,
      canonical_type: (t.canonical_type ?? null) as ('mood'|'genre'|'context'|null),
    })),
  }));
}
async getPlayUrl(musicId: number): Promise<string | null> {
  const r: any = await this.db.execute(sql`
    SELECT file_path FROM musics WHERE id = ${musicId} LIMIT 1
  `);
  const row = Array.isArray(r) ? r[0] : r?.rows?.[0];
  return row?.file_path ? String(row.file_path).trim() : null;
  }
}
