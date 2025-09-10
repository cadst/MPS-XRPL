import type { Pool } from 'pg';
import { REWARD_CODE_EARNING } from '../dto/me-rewards.dto';
import type {
  MonthRow, MusicRow, PlanRow, AggRow, DailyRow, PlaysCountRow, PlayListRow
} from './me.types';

const TZ = 'Asia/Seoul';

export class MeRepo {
  constructor(private readonly pool: Pool) {}

  async getMonthLabel() {
    const { rows } = await this.pool.query<MonthRow>(
      `SELECT to_char(timezone($1, now()), 'YYYY-MM') AS ym`,
      [TZ],
    );
    return rows[0]?.ym ?? '';
    // NOTE: string(YYYY-MM)
  }

  async listCompanyMusics(companyId: number, musicId?: number) {
    const args: any[] = [companyId];
    const filter = musicId ? (args.push(musicId), 'AND cm.music_id = $2') : '';
    const { rows } = await this.pool.query<MusicRow>(
      `
      SELECT m.id AS music_id, m.title, m.cover_image_url
      FROM company_musics cm
      JOIN musics m ON m.id = cm.music_id
      WHERE cm.company_id = $1
      ${filter}
      ORDER BY m.id
      `,
      args,
    );
    return rows;
  }

  async getMonthlyPlan(musicId: number) {
    const { rows } = await this.pool.query<PlanRow>(
      `
      SELECT reward_per_play::text, total_reward_count, remaining_reward_count
      FROM music_monthly_plans
      WHERE music_id = $1
        AND year_month = to_char(timezone($2, now()), 'YYYY-MM')
      LIMIT 1
      `,
      [musicId, TZ],
    );
    return rows[0] ?? null;
  }

  async getAggregates(companyId: number, musicId: number) {
    const { rows } = await this.pool.query<AggRow>(
      `
      WITH month_spent AS (
        SELECT COALESCE(SUM(amount),0)::numeric AS v
        FROM rewards
        WHERE company_id=$1 AND music_id=$2
          AND reward_code = $3::reward_code
          AND status IN ('pending','successed')::reward_status[]
          AND date_trunc('month', created_at AT TIME ZONE $4)
              = date_trunc('month', timezone($4, now()))
      ),
      lifetime AS (
        SELECT COALESCE(SUM(amount),0)::numeric AS v
        FROM rewards
        WHERE company_id=$1 AND music_id=$2
          AND reward_code = $3::reward_code
          AND status IN ('pending','successed')::reward_status[]
      ),
      last_used AS (
        SELECT MAX(created_at) AS v
        FROM music_plays
        WHERE company_id=$1 AND music_id=$2
      ),
      start_date AS (
        SELECT MIN(created_at) AS v
        FROM music_plays
        WHERE company_id=$1 AND music_id=$2
      )
      SELECT month_spent.v::text AS month_spent,
             lifetime.v::text     AS lifetime,
             to_char(last_used.v,  'YYYY-MM-DD"T"HH24:MI:SS"Z"')  AS last_used_at,
             to_char(start_date.v, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')  AS start_date
      FROM month_spent, lifetime, last_used, start_date
      `,
      [companyId, musicId, REWARD_CODE_EARNING, TZ],
    );
    return rows[0];
  }

  async getDaily(companyId: number, musicId: number, days: number) {
    const { rows } = await this.pool.query<DailyRow>(
      `
      WITH days AS (
        SELECT dd::date AS d
        FROM generate_series(
          (timezone($3, now())::date - ($4::int - 1)),
          timezone($3, now())::date,
          interval '1 day'
        ) AS dd
      )
      SELECT to_char(d, 'YYYY-MM-DD') AS date,
             COALESCE(SUM(r.amount),0)::numeric::text AS amount
      FROM days
      LEFT JOIN rewards r
        ON r.company_id=$1 AND r.music_id=$2
       AND r.reward_code=$5::reward_code
       AND r.status IN ('pending','successed')::reward_status[]
       AND (r.created_at AT TIME ZONE $3)::date = d
      GROUP BY d
      ORDER BY d
      `,
      [companyId, musicId, TZ, days, REWARD_CODE_EARNING],
    );
    return rows;
  }

  async countPlays(companyId: number, musicId: number) {
    const { rows } = await this.pool.query<PlaysCountRow>(
      `SELECT COUNT(*)::text AS c FROM music_plays WHERE company_id=$1 AND music_id=$2`,
      [companyId, musicId],
    );
    return Number(rows[0]?.c ?? '0');
  }

  async listPlays(companyId: number, musicId: number, limit: number, offset: number) {
    const { rows } = await this.pool.query<PlayListRow>(
      `
      SELECT p.id AS play_id,
             to_char(p.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS played_at,
             p.is_valid,
             p.meta,
             r.id   AS reward_id,
             r.reward_code,
             r.amount::text AS amount,
             r.status
      FROM music_plays p
      LEFT JOIN rewards r
        ON r.play_id = p.id
       AND r.reward_code = $3::reward_code
      WHERE p.company_id=$1 AND p.music_id=$2
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $4 OFFSET $5
      `,
      [companyId, musicId, REWARD_CODE_EARNING, limit, offset],
    );
    return rows;
  }
}
