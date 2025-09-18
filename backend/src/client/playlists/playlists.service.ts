// apps/backend/src/client/playlists/playlists.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { sql, inArray, eq, and } from 'drizzle-orm';
import { playlists, playlist_items as playlistItems, musics } from '../../db/schema';

@Injectable()
export class PlaylistService {
  constructor(@Inject('DB') private readonly db: any) {}
  private readonly logger = new Logger(PlaylistService.name);

  private logStart(tag: string, data?: any) {
    this.logger.log(`[${tag}] start ${data ? JSON.stringify(data) : ''}`);
  }
  private logOk(tag: string, data?: any) {
    this.logger.log(`[${tag}] ok ${data ? JSON.stringify(data) : ''}`);
  }
  private logError(tag: string, e: any) {
    const msg = e?.message || e;
    this.logger.error(`[${tag}] error: ${msg}`);
  }

  /** execute() 결과를 배열로 정규화 */
  private rows<T = any>(ret: any): T[] {
    return Array.isArray(ret) ? ret : (ret?.rows ?? []);
  }
  /** 첫 행 편의 유틸 */
  private firstRow<T = any>(ret: any): T | undefined {
    const r = this.rows<T>(ret);
    return r[0];
  }

  /** 내 플레이리스트 소유 여부 확인 */
  private async assertOwn(companyId: number, playlistId: number) {
    const pid = Number(playlistId);
    const [row] = await this.db
      .select({
        id: playlists.id,
        companyId: playlists.company_id,
      })
      .from(playlists)
      .where(eq(playlists.id, pid))
      .limit(1);

    if (!row) throw new NotFoundException('Playlist not found');
    if (Number(row.companyId) !== companyId) {
      throw new ForbiddenException('Not your playlist');
    }
  }

  /** (공통) UNIQUE 없이 중복 방지 삽입: VALUES + NOT EXISTS + RETURNING */
  private async insertPlaylistItemsNoUnique(tx: any, pid: number, ids: number[]) {
    if (!ids.length) return 0;

    // (pid, mid) 튜플들
    const pairs = ids.map((m) => sql`(${pid}::bigint, ${m}::bigint)`);

    const inserted = await tx.execute(sql`
      INSERT INTO playlist_items (playlist_id, music_id, added_at)
      SELECT v.pid, v.mid, now()
      FROM (VALUES ${sql.join(pairs, sql`, `)}) AS v(pid, mid)
      WHERE NOT EXISTS (
        SELECT 1
        FROM playlist_items pi
        WHERE pi.playlist_id = v.pid
          AND pi.music_id = v.mid
      )
      RETURNING id
    `);

    return this.rows(inserted).length; // 실제 삽입된 행 수
  }

  /** 목록 */
  async list(companyId: number) {
    const raw = await this.db.execute(sql`
      SELECT
        p.id                AS id,
        p.name              AS name,
        COALESCE(cnt.cnt,0) AS count,
        cov.cover_url       AS cover
      FROM playlists p
      LEFT JOIN (
        SELECT playlist_id, COUNT(*) AS cnt
          FROM playlist_items
         GROUP BY playlist_id
      ) cnt ON cnt.playlist_id = p.id
      LEFT JOIN LATERAL (
        SELECT m.cover_image_url AS cover_url
          FROM playlist_items pi
          JOIN musics m ON m.id = pi.music_id
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

  /** 상세(메타) */
  async detail(companyId: number, playlistId: number) {
    await this.assertOwn(companyId, playlistId);

    const raw = await this.db.execute(sql`
      SELECT p.id::bigint AS id, p.name, p.created_at, p.updated_at
        FROM playlists p
       WHERE p.id = ${Number(playlistId)}::bigint
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

  /** 트랙들 */
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
      WHERE pi.playlist_id = ${Number(playlistId)}::bigint
      ORDER BY pi.added_at ASC, pi.id ASC
    `);

    return this.rows(raw).map((r: any) => ({
      id: Number(r.id),
      title: String(r.title ?? ''),
      artist: String(r.artist ?? 'Various'),
      coverUrl: r.coverUrl ?? null,
      audioUrl: String(r.audioUrl ?? ''),
      durationSec: Number(r.durationSec ?? 0),
    }));
  }

  /** 트랙 전체 교체 (모두 지우고 다시 넣기) */
  async replaceTracks(companyId: number, playlistId: number, trackIds: number[]) {
    await this.assertOwn(companyId, playlistId);
    if (!Array.isArray(trackIds)) throw new BadRequestException('trackIds must be an array');

    const pid = Number(playlistId);

    await this.db.transaction(async (tx: any) => {
      await tx.delete(playlistItems).where(eq(playlistItems.playlist_id, pid));

      let added = 0;
      if (trackIds.length) {
        const valid = await tx
          .select({ id: musics.id })
          .from(musics)
          .where(inArray(musics.id, trackIds.map(Number)));

        const ids = this.rows(valid).map((v: any) => Number(v.id));
        if (ids.length) {
          added = await this.insertPlaylistItemsNoUnique(tx, pid, ids);
        }
      }

      await tx.update(playlists)
        .set({ updated_at: sql`now()` as any })
        .where(eq(playlists.id, pid));
      this.logger.debug(`[replaceTracks] replaced count=${added}`);
    });

    const cntRaw = await this.db.execute(sql`
      SELECT COUNT(*)::int AS count
        FROM playlist_items
       WHERE playlist_id = ${pid}::bigint
    `);
    const cntRow = this.firstRow<{ count: number }>(cntRaw);
    return { playlistId: pid, count: Number(cntRow?.count ?? 0) };
  }

  /** 선택 트랙 삭제 */
  async removeTracks(companyId: number, playlistId: number, trackIds: number[]) {
    await this.assertOwn(companyId, playlistId);
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      throw new BadRequestException('trackIds required');
    }

    const pid = Number(playlistId);

    return this.db.transaction(async (tx: any) => {
      await tx
        .delete(playlistItems)
        .where(
          and(
            eq(playlistItems.playlist_id, pid),
            inArray(playlistItems.music_id, trackIds.map(Number)),
          ),
        );

      const [{ count }] = await tx
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(playlistItems)
        .where(eq(playlistItems.playlist_id, pid));

      let playlistDeleted = false;
      if ((count ?? 0) === 0) {
        await tx.delete(playlists).where(eq(playlists.id, pid));
        playlistDeleted = true;
      }

      return { playlistId: pid, count: count ?? 0, playlistDeleted };
    });
  }

  /** 생성 (선택 초기 트랙 포함 가능) */
  async create(companyId: number, dto: { name: string; trackIds?: number[] }) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('name required');

    return this.db.transaction(async (tx: any) => {
      const inserted = await tx
        .insert(playlists)
        .values({
          company_id: companyId,
          name,
          created_at: sql`now()` as any,
          updated_at: sql`now()` as any,
        })
        .returning({ id: playlists.id });

      const newIdNum = Number(inserted?.[0]?.id);
      if (!Number.isFinite(newIdNum)) {
        throw new BadRequestException('failed to create playlist');
      }

      if (dto.trackIds?.length) {
        const valid = await tx
          .select({ id: musics.id })
          .from(musics)
          .where(inArray(musics.id, dto.trackIds.map(Number)));

        const musicIds = valid.map((v: any) => Number(v.id));
        if (musicIds.length) {
          const added = await this.insertPlaylistItemsNoUnique(tx, newIdNum, musicIds);
          this.logger.debug(`[create] initial insert count=${added}`);
        }
      }

      return {
        id: newIdNum,
        name,
        count: dto.trackIds?.length ? dto.trackIds.length : 0, // 실제 inserted 수로 바꾸고 싶으면 위 added 사용
        cover: null as string | null,
      };
    });
  }

  /** 삭제 */
  async remove(companyId: number, playlistId: number) {
    await this.assertOwn(companyId, playlistId);
    const pid = Number(playlistId);

    await this.db.transaction(async (tx: any) => {
      await tx.delete(playlistItems).where(eq(playlistItems.playlist_id, pid));
      await tx.delete(playlists).where(eq(playlists.id, pid));
    });

    return { deleted: true };
  }

  /** 사용(선택 없으면 전곡) */
  async use(
    companyId: number,
    playlistId: number,
    dto: { trackIds?: number[]; useCase?: 'full' | 'intro' | 'lyrics' },
  ) {
    await this.assertOwn(companyId, playlistId);

    const pid = Number(playlistId);
    const baseIds =
      dto.trackIds?.length
        ? dto.trackIds.map(Number)
        : this.rows(
            await this.db
              .select({ id: playlistItems.music_id })
              .from(playlistItems)
              .where(eq(playlistItems.playlist_id, pid)),
          ).map((r: any) => Number(r.id));

    if (!baseIds.length) return { count: 0 };

    const found = await this.db
      .select({ id: musics.id })
      .from(musics)
      .where(inArray(musics.id, baseIds));

    return { count: this.rows(found).length };
  }

  /** 트랙 추가 */
  async addTracks(companyId: number, playlistId: number, trackIds: number[]) {
    this.logStart('addTracks', { companyId, playlistId, trackIds });
    await this.assertOwn(companyId, playlistId);
    if (!Array.isArray(trackIds) || trackIds.length === 0) {
      throw new BadRequestException('trackIds required');
    }

    const pid = Number(playlistId);
    const idsReq = trackIds.map(Number);

    try {
      const ret = await this.db.transaction(async (tx: any) => {
        const found = await tx
          .select({ id: musics.id })
          .from(musics)
          .where(inArray(musics.id, idsReq));

        const ids = this.rows(found).map((r: any) => Number(r.id));
        this.logger.debug(`[addTracks] validIds=${JSON.stringify(ids)}`);

        let insertedCount = 0;
        if (ids.length) {
          insertedCount = await this.insertPlaylistItemsNoUnique(tx, pid, ids);
        }

        await tx
          .update(playlists)
          .set({ updated_at: sql`now()` as any })
          .where(eq(playlists.id, pid));

        const [{ count }] = await tx
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(playlistItems)
          .where(eq(playlistItems.playlist_id, pid));

        return { playlistId: pid, added: insertedCount, count: count ?? 0 };
      });

      this.logOk('addTracks', ret);
      return ret;
    } catch (e) {
      this.logError('addTracks', e);
      throw e;
    }
  }
}
