import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql, inArray, eq, and } from 'drizzle-orm';
import { playlists, playlistItems, musics } from '../../db/schema.introspected';

@Injectable()
export class PlaylistService {
  constructor(@Inject('DB') private readonly db: any) {}

  /** execute() 결과를 배열로 정규화 */
  private rows<T = any>(ret: any): T[] {
    return Array.isArray(ret) ? ret : (ret?.rows ?? []);
  }
  /** 첫 행 편의 유틸 */
  private firstRow<T = any>(ret: any): T | undefined {
    const r = this.rows<T>(ret);
    return r[0];
  }

  private async assertOwn(companyId: number, playlistId: number) {
    const [row] = await this.db
      .select({ id: playlists.id, companyId: playlists.companyId })
      .from(playlists)
      .where(eq(playlists.id, BigInt(playlistId))) // playlists.id: bigint
      .limit(1);

    if (!row) throw new NotFoundException('Playlist not found');
    if (Number(row.companyId) !== companyId) throw new ForbiddenException('Not your playlist');
  }

  async list(companyId: number) {
    const raw = await this.db.execute(sql`
      SELECT
        p.id                AS id,        -- bigint
        p.name              AS name,
        COALESCE(cnt.cnt,0) AS count,     -- int
        cov.cover_url       AS cover      -- text|null
      FROM playlists p
      LEFT JOIN (
        SELECT playlist_id, COUNT(*) AS cnt
        FROM playlist_items GROUP BY playlist_id
      ) cnt ON cnt.playlist_id = p.id
      LEFT JOIN LATERAL (
        SELECT m.cover_image_url AS cover_url
        FROM playlist_items pi JOIN musics m ON m.id = pi.music_id
        WHERE pi.playlist_id = p.id
        ORDER BY pi.added_at ASC, pi.id ASC
        LIMIT 1
      ) cov ON TRUE
      WHERE p.company_id = ${companyId}
      ORDER BY p.created_at DESC, p.id DESC
    `);

    return this.rows(raw).map((r: any) => ({
      id: Number(r.id),
      name: String(r.name ?? ''),
      count: Number(r.count ?? r.cnt ?? 0),
      cover: r.cover ?? r.cover_url ?? null,
    }));
  }

  async detail(companyId: number, playlistId: number) {
    await this.assertOwn(companyId, playlistId);

    const raw = await this.db.execute(sql`
      SELECT p.id::bigint AS id, p.name, p.created_at, p.updated_at
      FROM playlists p WHERE p.id = ${playlistId}::bigint
    `);
    const row = this.firstRow<any>(raw);
    if (!row) throw new NotFoundException('Playlist not found');

    return {
      id: Number(row.id),
      name: String(row.name ?? ''),
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  async tracks(companyId: number, playlistId: number) {
    await this.assertOwn(companyId, playlistId);

    const raw = await this.db.execute(sql`
      SELECT
        m.id::bigint                 AS id,
        m.title                      AS title,
        COALESCE(m.artist,'Various') AS artist,
        m.cover_image_url            AS "coverUrl",
        m.file_path                  AS "audioUrl",
        COALESCE(m.duration_sec,0)   AS "durationSec"
      FROM playlist_items pi
      JOIN musics m ON m.id = pi.music_id
      WHERE pi.playlist_id = ${playlistId}::bigint
      ORDER BY pi.added_at ASC, pi.id ASC
    `);
    // 프론트 Track[] 모양으로 보장
    return this.rows(raw).map((r: any) => ({
      id: Number(r.id),
      title: String(r.title ?? ''),
      artist: String(r.artist ?? 'Various'),
      coverUrl: r.coverUrl ?? null,
      audioUrl: String(r.audioUrl ?? ''),
      durationSec: Number(r.durationSec ?? 0),
    }));
  }

  async replaceTracks(companyId: number, playlistId: number, trackIds: number[]) {
    await this.assertOwn(companyId, playlistId);
    if (!Array.isArray(trackIds)) throw new BadRequestException('trackIds must be an array');

    await this.db.transaction(async (tx: any) => {
      // playlist_items.playlist_id 는 number 매핑일 가능성 높음 → Number 사용
      await tx.delete(playlistItems).where(eq(playlistItems.playlistId, Number(playlistId)));

      if (trackIds.length) {
        // musics.id 가 number 매핑이면 Number로 맞추세요 (BigInt 아님)
        const valid = await tx
          .select({ id: musics.id })
          .from(musics)
          .where(inArray(musics.id, trackIds.map(BigInt)));

        const ids = this.rows(valid).map((v: any) => Number(v.id));
        if (ids.length) {
          await tx.execute(sql`
            INSERT INTO playlist_items (playlist_id, music_id, added_at)
            SELECT ${playlistId}::bigint, m_id::bigint, now()
            FROM unnest(${ids}::bigint[]) AS m_id
            ON CONFLICT (playlist_id, music_id) DO NOTHING
          `);
        }
      }

      // playlists.id 는 bigint 매핑 → BigInt 사용
      await tx.update(playlists)
        .set({ updatedAt: sql`now()` as any })
        .where(eq(playlists.id, BigInt(playlistId)));
    });

    const cntRaw = await this.db.execute(sql`
      SELECT COUNT(*)::int AS count FROM playlist_items WHERE playlist_id = ${playlistId}::bigint
    `);
    const cntRow = this.firstRow<{ count: number }>(cntRaw);
    return { playlistId, count: Number(cntRow?.count ?? 0) };
  }
  async removeTracks(companyId: number, playlistId: number, trackIds: number[]) {
    await this.assertOwn(companyId, playlistId);
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      throw new BadRequestException('trackIds required');
    }
  
    const pid = Number(playlistId); // ← number 로 통일
  
    return this.db.transaction(async (tx: any) => {
      // 1) 선택 트랙 삭제
      await tx
        .delete(playlistItems)
        .where(
          and(
            eq(playlistItems.playlistId, pid),
            inArray(playlistItems.musicId, trackIds.map(Number)), // musicId도 number면 Number로
          ),
        );
  
      // 2) 남은 곡 수 조회
      const [{ count }] = await tx
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(playlistItems)
        .where(eq(playlistItems.playlistId, pid));
  
      // 3) 0이면 플레이리스트도 삭제 (soft delete면 update로 대체)
      let playlistDeleted = false;
      if ((count ?? 0) === 0) {
        await tx.delete(playlists).where(eq(playlists.id, BigInt(pid))); // playlists.id도 number 타입일 때
        playlistDeleted = true;
      }
  
      return { playlistId: pid, count: count ?? 0, playlistDeleted };
    });
  }
  
  async create(companyId: number, dto: { name: string; trackIds?: number[] }) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('name required');

    return this.db.transaction(async (tx: any) => {
      // 1) 플레이리스트 생성 (playlists.id: bigint)
      const inserted = await tx
        .insert(playlists)
        .values({
          companyId,                // 스키마 타입 number/bigint에 맞춰 자동 매핑
          name,
          createdAt: sql`now()` as any,
          updatedAt: sql`now()` as any,
        })
        .returning({ id: playlists.id });

      const newIdBig = inserted?.[0]?.id as bigint;
      if (newIdBig === undefined || newIdBig === null) {
        throw new BadRequestException('failed to create playlist');
      }
      const newIdNum = Number(newIdBig);

      // 2) 초기 트랙이 있으면 유효한 음악만 삽입
      if (dto.trackIds?.length) {
        // musics.id가 bigint라면 BigInt로 비교
        const valid = await tx
          .select({ id: musics.id })
          .from(musics)
          .where(inArray(musics.id, dto.trackIds.map(BigInt)));

        const musicIdsBig = valid.map((v: any) => v.id as bigint);
        if (musicIdsBig.length) {
          await tx.execute(sql`
            INSERT INTO playlist_items (playlist_id, music_id, added_at)
            SELECT ${newIdBig}::bigint, m_id::bigint, now()
            FROM unnest(${musicIdsBig}::bigint[]) AS m_id
            ON CONFLICT (playlist_id, music_id) DO NOTHING
          `);
        }
      }

      // 3) 생성 결과 반환(프론트 카드용 포맷)
      return {
        id: newIdNum,
        name,
        count: dto.trackIds?.length ? dto.trackIds.length : 0,
        cover: null as string | null,
      };
    });
  }
  

  async remove(companyId: number, playlistId: number) {
    await this.assertOwn(companyId, playlistId);
    await this.db.transaction(async (tx: any) => {
      await tx.delete(playlistItems).where(eq(playlistItems.playlistId, Number(playlistId)));
      await tx.delete(playlists).where(eq(playlists.id, BigInt(playlistId)));
    });
    return { deleted: true };
  }

  async use(
    companyId: number,
    playlistId: number,
    dto: { trackIds?: number[]; useCase?: 'full'|'intro'|'lyrics' },
  ) {
    await this.assertOwn(companyId, playlistId);

    // 선택 ids 없으면 플레이리스트 전체 조회
    const baseIds = dto.trackIds?.length
      ? dto.trackIds
      : this.rows(
          await this.db
            .select({ id: playlistItems.musicId })
            .from(playlistItems)
            .where(eq(playlistItems.playlistId, Number(playlistId)))
        ).map((r: any) => Number(r.id));

    if (!baseIds.length) return { count: 0 };

    // 유효한 music만 필터
    const found = await this.db
      .select({ id: musics.id })
      .from(musics)
      .where(inArray(musics.id, baseIds.map(BigInt)));

    return { count: this.rows(found).length };
  }
}
