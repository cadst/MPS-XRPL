import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { TagsService } from './tags.service';

const LOCK_KEY = 2025091201;

@Injectable()
export class TagsCron {
  constructor(private readonly tags: TagsService) { }

  @Cron('0 */15 * * * *', { timeZone: 'Asia/Seoul' })
  async everyMinute() {
    if (process.env.TAGS_AUTO_NORMALIZE !== '1') return;
    await this.runSafely(async () => {
      await this.tags.quickSqlPrepass();
      const limit = Number(process.env.TAGS_NORMALIZE_LIMIT ?? 100);
      const res = await this.tags.backfillNullMusicTags('mood', limit);
      console.log('[TagsCron] normalized:', res);
    });
  }

  private async runSafely(job: () => Promise<void>) {
    const anyDb: any = (this.tags as any).db;
    const r = await anyDb.execute(sql`SELECT pg_try_advisory_lock(${LOCK_KEY}) AS ok`);
    const row = Array.isArray(r) ? (r as any)[0] : (r as any).rows?.[0];
    const ok = !!(row?.ok ?? row?.pg_try_advisory_lock);
    if (!ok) return;
    try { await job(); }
    finally { await anyDb.execute(sql`SELECT pg_advisory_unlock(${LOCK_KEY})`); }
  }
}
