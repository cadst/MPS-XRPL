// apps/backend/src/client/me/me.service.ts
import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import dayjs from 'dayjs';
import { sql, eq, desc, and, gt } from 'drizzle-orm';
import {
  companies,
  company_subscriptions,
  musics,
  company_musics,
  monthly_music_rewards,
  rewards,
  music_plays,
} from '../../db/schema';
import { REWARD_CODE_EARNING } from './dto/me-rewards.dto';

const TZ = 'Asia/Seoul';

@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);
  constructor(@Inject('DB') private readonly db: any) {}

  private PLAN_PRICE: Record<'standard' | 'business', number> = {
    standard: 19000,
    business: 29000,
  };

  private buildSelect<T extends Record<string, any>>(entries: Array<[keyof T & string, any]>): T {
    const filtered = entries.filter(([, v]) => v !== undefined && v !== null);
    const obj = Object.fromEntries(filtered) as T;
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) {
        throw new Error(`[buildSelect] "${k}" is ${v}`);
      }
    }
    return obj;
  }

  async getMe(companyId: number) {
    // --- Company
    const companySelect = this.buildSelect([
      ['id', companies.id],
      ['name', companies.name],
      ['grade', companies.grade],
      ['ceo_name', companies.ceo_name],
      ['phone', companies.phone],
      ['homepage_url', companies.homepage_url],
      ['profile_image_url', companies.profile_image_url],
      ['smart_account_address', companies.smart_account_address],
      ['total_rewards_earned', companies.total_rewards_earned],
      ['total_rewards_used', companies.total_rewards_used],
    ]);

    const [company] = await this.db
      .select(companySelect)
      .from(companies)
      .where(eq(companies.id, (companyId)))
      .limit(1);

    const reservedCol =
      (company_subscriptions as any).reserved_mileage_next_payment as any | undefined;

    const subSelect = {
      id: company_subscriptions.id,
      company_id: company_subscriptions.company_id,
      tier: company_subscriptions.tier,
      start_date: company_subscriptions.start_date,
      end_date: company_subscriptions.end_date,
      ...(reservedCol ? { reserved_next: reservedCol } : {}),
    } as const;

    const [sub] = await this.db
      .select(subSelect)
      .from(company_subscriptions)
      .where(eq(company_subscriptions.company_id, companyId))
      .orderBy(desc(company_subscriptions.end_date), desc(company_subscriptions.start_date))
      .limit(1);

    const usingCountP = this.db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM ${company_musics} cm
      WHERE cm.company_id = ${companyId}
    `);

    const usingListP = this.db.execute(sql`
      SELECT
        m.id              AS music_id,
        m.title,
        m.artist,
        CASE
          WHEN m.cover_image_url IS NULL OR m.cover_image_url = '' THEN NULL
          WHEN m.cover_image_url LIKE 'http%' THEN m.cover_image_url
          WHEN m.cover_image_url LIKE '/uploads/%' THEN m.cover_image_url
          ELSE '/uploads/images/' || m.cover_image_url
        END               AS cover_image_url,
        NULL::timestamptz AS last_used_at
      FROM ${company_musics} cm
      JOIN ${musics} m ON m.id = cm.music_id
      WHERE cm.company_id = ${companyId}
      ORDER BY COALESCE(m.updated_at, m.created_at) DESC NULLS LAST
      LIMIT 10
    `);

    const [usingCountRow, usingRows] = await Promise.all([usingCountP, usingListP]);

    const earned = Number(company?.total_rewards_earned ?? 0);
    const used   = Number(company?.total_rewards_used ?? 0);
    const rewardBalance = Math.max(0, earned - used);

    const today = dayjs();
    const end = sub?.end_date ? dayjs(sub.end_date) : null;
    const remainingDays = end ? Math.max(0, end.diff(today, 'day')) : null;

    const planPrice = sub?.tier && this.PLAN_PRICE[sub.tier as 'standard' | 'business'];
    const capByPlan = planPrice ? Math.floor(planPrice * 0.3) : 0;
    const maxUsableNextPayment = Math.max(0, Math.min(rewardBalance, capByPlan));
    const reservedNext = Number((sub as any)?.reserved_next ?? 0);

    const bigintReplacer = (_: string, v: any) => (typeof v === 'bigint' ? v.toString() : v);
    this.logger.debug('getMe.company = ' + JSON.stringify(company, bigintReplacer));

    return {
      company: company
        ? {
            id: Number(company.id),
            name: company.name,
            grade: company.grade,
            ceo_name: company.ceo_name ?? null,
            phone: company.phone ?? null,
            homepage_url: company.homepage_url ?? null,
            profile_image_url: company.profile_image_url ?? null,
            smart_account_address: company.smart_account_address ?? null,
            total_rewards_earned: earned,
            total_rewards_used: used,
            reward_balance: rewardBalance,
          }
        : null,

      subscription: sub
        ? {
            plan: sub.tier,
            status: end && end.isAfter(today) ? 'active' : 'none',
            start_date: sub.start_date,
            end_date: sub.end_date,
            next_billing_at: sub.end_date ?? null,
            remaining_days: remainingDays,
            reserved_rewards_next_payment: reservedNext,
            max_usable_next_payment: maxUsableNextPayment,
          }
        : {
            plan: 'free',
            status: 'none',
            remaining_days: null,
            reserved_rewards_next_payment: 0,
            max_usable_next_payment: 0,
          },

      api_key: { last4: null },

      using_summary: {
        using_count: Number((usingCountRow as any)?.rows?.[0]?.cnt ?? 0),
      },

      using_list:
        (usingRows as any)?.rows?.map((r: any) => ({
          id: r.music_id,
          title: r.title,
          artist: r.artist,
          cover: r.cover_image_url,
          lastUsedAt: r.last_used_at, // 현재는 NULL
        })) ?? [],
    };
  }

  async updateProfile(
    companyId: number,
    dto: { ceo_name?: string; phone?: string; homepage_url?: string; profile_image_url?: string },
  ) {
    const setPayload: Record<string, any> = {
      ...(dto.ceo_name !== undefined ? { ceo_name: dto.ceo_name } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.homepage_url !== undefined ? { homepage_url: dto.homepage_url } : {}),
      ...(dto.profile_image_url !== undefined ? { profile_image_url: dto.profile_image_url } : {}),
      ...(('updated_at' in companies) ? { updated_at: sql`now()` } : {}),
    };

    if (Object.keys(setPayload).length) {
      await this.db
        .update(companies)
        .set(setPayload)
        .where(eq(companies.id, (companyId)));
    }
    return this.getMe(companyId);
  }

  async subscribe(companyId: number, dto: { tier: 'standard' | 'business'; use_rewards: number }) {
    const price = this.PLAN_PRICE[dto.tier];
    if (!price) throw new BadRequestException('invalid tier');

    const now = new Date();
    const start_date = dayjs(now).startOf('day').toDate();
    const end_date = dayjs(start_date).add(1, 'month').toDate();

    return await this.db.transaction(async (tx: any) => {
      // 1) 회사 잠금 후 보유 리워드 확인
      const { rows } = await tx.execute(sql`
        SELECT total_rewards_earned, total_rewards_used
        FROM ${companies}
        WHERE id = ${BigInt(companyId)}
        FOR UPDATE
      `);
      const c = rows?.[0];
      if (!c) throw new BadRequestException('company not found');

      const earned = Number(c.total_rewards_earned ?? 0);
      const used = Number(c.total_rewards_used ?? 0);
      const balance = Math.max(0, earned - used);

      const cap = Math.floor((price * 3) / 10);
      const wantUse = Math.max(0, Math.floor(dto.use_rewards || 0));
      const use = Math.min(wantUse, cap, balance);
      const actualPaid = Math.max(0, price - use);

      await tx.insert(company_subscriptions).values({
        company_id: companyId,
        tier: dto.tier,
        start_date,
        end_date,
        total_paid_amount: price,
        payment_count: 1,
        discount_amount: use,
        actual_paid_amount: actualPaid,
        created_at: now,
        updated_at: now,
      } as any);

      await tx
        .update(companies)
        .set({
          grade: dto.tier,
          total_rewards_used: sql`${companies.total_rewards_used} + ${use}`,
          updated_at: now,
        } as any)
        .where(eq(companies.id, (companyId)));

      return this.getMe(companyId);
    });
  }

  async updateSubscriptionSettings(
    companyIdNum: number,
    dto: { useMileage: number; reset?: boolean },
  ) {
    const companyId = companyIdNum; // company_subscriptions.company_id는 number 모드

    return await this.db.transaction(async (tx: any) => {
      const reservedCol =
        (company_subscriptions as any).reserved_mileage_next_payment as any | undefined;

      const subSelect = {
        id: company_subscriptions.id,
        company_id: company_subscriptions.company_id,
        tier: company_subscriptions.tier,
        end_date: company_subscriptions.end_date,
        ...(reservedCol ? { reserved_next: reservedCol } : {}),
      } as const;

      const [sub] = await tx
        .select(subSelect)
        .from(company_subscriptions)
        .where(and(eq(company_subscriptions.company_id, companyId), gt(company_subscriptions.end_date, sql`now()`)))
        .orderBy(desc(company_subscriptions.end_date))
        .limit(1);

      if (!sub) {
        throw new BadRequestException('활성화된 구독이 없습니다.');
      }

      const { rows } = await tx.execute(sql`
        SELECT total_rewards_earned, total_rewards_used
        FROM ${companies}
        WHERE id = ${BigInt(companyId)}
        FOR UPDATE
      `);
      const c = rows?.[0];
      if (!c) throw new BadRequestException('company not found');

      const earned = Number(c.total_rewards_earned ?? 0);
      const used = Number(c.total_rewards_used ?? 0);
      const balance = Math.max(0, earned - used);

      const planPrice = this.PLAN_PRICE[sub.tier as 'standard' | 'business'];
      if (!planPrice) throw new BadRequestException('invalid plan for reservation');
      const cap = Math.floor(planPrice * 0.3);

      const requested = dto.reset ? 0 : Math.max(0, Math.floor(Number(dto.useMileage || 0)));
      const maxUsable = Math.max(0, Math.min(balance, cap));
      const clamped = Math.min(requested, maxUsable);

      const prevReserved = Number((sub as any).reserved_next ?? 0);
      if (clamped === prevReserved) {
        return {
          ok: true,
          reserved_rewards_next_payment: clamped,
          max_usable_next_payment: maxUsable,
          reason: '구독권 할인',
          unchanged: true,
        };
      }

      const reservedName =
        (company_subscriptions as any).reserved_mileage_next_payment?.name ??
        'reserved_mileage_next_payment';

      await tx
        .update(company_subscriptions)
        .set({
          [reservedName]: clamped as any,
          updated_at: sql`now()`,
        } as any)
        .where(eq(company_subscriptions.id, sub.id));

      return {
        ok: true,
        reserved_rewards_next_payment: clamped,
        max_usable_next_payment: maxUsable,
        reason: '구독권 할인',
      };
    });
  }

  async getHistory(companyIdNum: number) {
    const companyId = BigInt(companyIdNum);

    const sel: Record<string, any> = {
      id: company_subscriptions.id,
      company_id: company_subscriptions.company_id,
      tier: company_subscriptions.tier,
      start_date: company_subscriptions.start_date,
    };
    if ((company_subscriptions as any).created_at) {
      sel.created_at = (company_subscriptions as any).created_at;
    }
    if ((company_subscriptions as any).total_paid_amount) {
      sel.total_paid_amount = (company_subscriptions as any).total_paid_amount;
    }
    if ((company_subscriptions as any).actual_paid_amount) {
      sel.actual_paid_amount = (company_subscriptions as any).actual_paid_amount;
    }
    if ((company_subscriptions as any).discount_amount) {
      sel.discount_amount = (company_subscriptions as any).discount_amount;
    }

    const rows = await this.db
      .select(sel)
      .from(company_subscriptions)
      .where(eq(company_subscriptions.company_id, companyId as any))
      .orderBy(
        (sel as any).created_at ? desc((company_subscriptions as any).created_at)
                                : desc(company_subscriptions.start_date),
        desc(company_subscriptions.id),
      )
      .limit(50);

    const toNum = (v: any) => {
      const n = typeof v === 'string' ? Number(v) : Number(v ?? 0);
      return Number.isFinite(n) ? n : 0;
    };
    const fmt = (v: any) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '');

    // 구매내역
    const purchases = rows.map((r: any) => ({
      id: String(r.id),
      date: fmt(r.start_date ?? r.created_at),
      item: String(r.tier ?? '').toLowerCase() === 'business' ? 'Business 월 구독' : 'Standard 월 구독',
      amount: toNum(r.actual_paid_amount ?? r.total_paid_amount),
    }));

    // 마일리지(할인) 내역
    const mileageLogs = rows
      .filter((r: any) => toNum(r.discount_amount) > 0)
      .map((r: any) => ({
        id: `m_${r.id}`,
        at: fmt(r.start_date ?? r.created_at),
        reason: '구독권 할인',
        delta: -Math.abs(toNum(r.discount_amount)),
      }));

    return { purchases, mileageLogs };
  }

  /* =========================
   *  /me/rewards & /me/plays
   * ========================= */

  /** /me/rewards : 아코디언/상단 요약/최근 N일 */
  async getRewardsSummary(params: { companyId: number; days?: number; musicId?: number }) {
    const { companyId, musicId } = params;
    const days = Number(params.days ?? 7);
    if (!companyId) throw new BadRequestException('companyId missing');
    if (days <= 0 || days > 60) throw new BadRequestException('invalid days');

    // 월 레이블
    const monthRes = await this.db.execute(sql`
      SELECT to_char(timezone(${TZ}, now()), 'YYYY-MM') AS ym
    `);
    const month = (monthRes as any).rows?.[0]?.ym ?? '';

    // 회사가 보유한 음원
    const musicFilter = musicId ? sql`AND cm.music_id = ${musicId}` : sql``;
    const musicsRes = await this.db.execute(sql`
      SELECT m.id AS music_id, m.title, m.cover_image_url
      FROM ${company_musics} cm
      JOIN ${musics} m ON m.id = cm.music_id
      WHERE cm.company_id = ${companyId}
      ${musicFilter}
      ORDER BY m.id
    `);
    const musicRows: Array<{ music_id: number; title: string|null; cover_image_url: string|null }> =
      (musicsRes as any).rows ?? [];

    if (musicRows.length === 0) {
      return { month, days, items: [], totals: { monthBudget: 0, monthSpent: 0, monthRemaining: 0, lifetimeExtracted: 0 } };
    }

    const items = await Promise.all(
      musicRows.map(async (m) => {
        const mid = m.music_id;

        // 월 계획
        const planRes = await this.db.execute(sql`
          SELECT reward_per_play::text, total_reward_count, remaining_reward_count
          FROM ${monthly_music_rewards}
          WHERE music_id = ${mid}
            AND year_month = to_char(timezone(${TZ}, now()), 'YYYY-MM')
          LIMIT 1
        `);
        const plan = (planRes as any).rows?.[0] ?? null;
        const rewardPerPlay = plan?.reward_per_play ? Number(plan.reward_per_play) : null;
        const totalRewardCount = plan?.total_reward_count ?? null;
        const remainingRewardCount = plan?.remaining_reward_count ?? null;

        const monthBudget =
          rewardPerPlay != null && totalRewardCount != null ? rewardPerPlay * totalRewardCount : 0;
        const remainingByPlanAmount =
          rewardPerPlay != null && remainingRewardCount != null ? rewardPerPlay * remainingRewardCount : null;

        // 이번달 사용액/누적/최근사용/시작일
        const aggRes = await this.db.execute(sql`
          WITH month_spent AS (
            SELECT COALESCE(SUM(amount),0)::numeric AS v
            FROM ${rewards}
            WHERE company_id = ${companyId} AND music_id = ${mid}
              AND reward_code = ${REWARD_CODE_EARNING}::reward_code
              AND status = ANY(${sql`ARRAY['pending'::reward_status,'successed'::reward_status]`})
              AND date_trunc('month', created_at AT TIME ZONE ${TZ})
                  = date_trunc('month', timezone(${TZ}, now()))
          ),
          lifetime AS (
            SELECT COALESCE(SUM(amount),0)::numeric AS v
            FROM ${rewards}
            WHERE company_id = ${companyId} AND music_id = ${mid}
            AND reward_code = ${REWARD_CODE_EARNING}::reward_code
            AND status IN ('pending'::reward_status,'successed'::reward_status)
          ),
         last_used AS (
            SELECT MAX(p.created_at) AS v
            FROM ${music_plays} p
            WHERE p.using_company_id = ${companyId} AND p.music_id = ${mid}
          ),
          start_date AS (
            SELECT MIN(p.created_at) AS v
            FROM ${music_plays} p
            WHERE p.using_company_id = ${companyId} AND p.music_id = ${mid}
          )
          SELECT
            month_spent.v::text AS month_spent,
            lifetime.v::text    AS lifetime,
            to_char(timezone(${TZ}, last_used.v),  'YYYY-MM-DD HH24:MI') AS last_used_at,
            to_char(timezone(${TZ}, start_date.v), 'YYYY-MM-DD HH24:MI') AS start_date
          FROM month_spent, lifetime, last_used, start_date
        `);
        const agg = (aggRes as any).rows?.[0] ?? {};
        const monthSpent = Number(agg?.month_spent ?? '0');
        const lifetimeExtracted = Number(agg?.lifetime ?? '0');
        const lastUsedAt = agg?.last_used_at ?? null;
        const startDate = agg?.start_date ?? null;
        const monthRemaining = Math.max(monthBudget - monthSpent, 0);

        // 최근 N일
        const dailyRes = await this.db.execute(sql`
          WITH days AS (
            SELECT dd::date AS d
            FROM generate_series(
              (timezone(${TZ}, now())::date - (${days}::int - 1)),
              timezone(${TZ}, now())::date,
              interval '1 day'
            ) AS dd
          )
          SELECT to_char(d, 'YYYY-MM-DD') AS date,
                 COALESCE(SUM(r.amount),0)::numeric::text AS amount
          FROM days
          LEFT JOIN ${rewards} r
            ON r.company_id = ${companyId} AND r.music_id = ${mid}
            AND r.reward_code = ${REWARD_CODE_EARNING}::reward_code
            AND r.status IN ('pending'::reward_status,'successed'::reward_status)
            AND (r.created_at AT TIME ZONE ${TZ})::date = d
          GROUP BY d
          ORDER BY d
        `);
        const dailyRows: Array<{ date: string; amount: string }> = (dailyRes as any).rows ?? [];

        return {
          musicId: mid,
          title: m.title,
          coverImageUrl: m.cover_image_url,
          // ⬇ 프리픽스 없이 반환
          playEndpoint: `/music/${mid}/play`,
          lyricsEndpoint: `/lyric/${mid}/download`,
          startDate,
          rewardPerPlay,
          monthBudget,
          monthSpent,
          monthRemaining,
          remainingByPlanCount: remainingRewardCount,
          remainingByPlanAmount,
          lifetimeExtracted,
          lastUsedAt,
          daily: dailyRows.map((x) => ({ date: x.date, amount: Number(x.amount) })),
          leadersEarned: lifetimeExtracted,
        };
      }),
    );

    const totals = items.reduce(
      (a, x) => {
        a.monthBudget += x.monthBudget;
        a.monthSpent += x.monthSpent;
        a.monthRemaining += x.monthRemaining;
        a.lifetimeExtracted += x.lifetimeExtracted;
        return a;
      },
      { monthBudget: 0, monthSpent: 0, monthRemaining: 0, lifetimeExtracted: 0 },
    );

    return { month, days, items, totals };
  }

  /** /me/plays : 모달 리스트(유효/무효 포함, 리워드 join=earning만) */
  async getPlays(params: { companyId: number; musicId: number; page?: number; limit?: number }) {
    const { companyId, musicId } = params;
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 20);
    if (!companyId || !musicId) throw new BadRequestException('companyId/musicId missing');
    const offset = (page - 1) * limit;
  
    // 총 개수
    const cntRes = await this.db.execute(sql`
      SELECT COUNT(*)::text AS c
      FROM ${music_plays} p
      WHERE p.using_company_id = ${companyId} AND p.music_id = ${musicId}
    `);
    const total = Number((cntRes as any).rows?.[0]?.c ?? '0');
  
    // 리스트: p.meta 제거 → NULL로 대체
    const listRes = await this.db.execute(sql`
      SELECT
        p.id AS play_id,
        to_char(timezone(${TZ}, p.created_at), 'YYYY-MM-DD HH24:MI') AS played_at,
        CASE
          WHEN r.id IS NOT NULL
           AND r.status = ANY(${sql`ARRAY['pending'::reward_status,'successed'::reward_status]`})
          THEN TRUE ELSE FALSE
        END AS is_valid,
        NULL::jsonb AS meta,                    -- ⬅⬅⬅ 여기!
        r.id   AS reward_id,
        r.reward_code,
        r.amount::text AS amount,
        r.status
      FROM ${music_plays} p
      LEFT JOIN ${rewards} r
        ON r.play_id = p.id
       AND r.reward_code = ${REWARD_CODE_EARNING}::reward_code
      WHERE p.using_company_id = ${companyId} AND p.music_id = ${musicId}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
  
    const rows: Array<{
      play_id: number; played_at: string; is_valid: boolean; meta: any;
      reward_id: number | null; reward_code: '0'|'1'|'2'|'3' | null;
      amount: string | null; status: 'pending'|'successed' | null;
    }> = (listRes as any).rows ?? [];
  
    return {
      page, limit, total,
      items: rows.map((r) => ({
        playId: r.play_id,
        playedAt: r.played_at,
        isValid: !!r.is_valid,
        meta: r.meta ?? null,
        rewardId: r.reward_id,
        rewardCode: r.reward_code,
        amount: r.amount != null ? Number(r.amount) : null,
        status: r.status,
      })),
    };
  }
  async removeUsing(companyIdNum: number, musicIdNum: number) {
    const companyId = companyIdNum; // company_musics.company_id 가 number 타입이라면 그대로 사용
    const musicId = musicIdNum;
  
    return await this.db.transaction(async (tx: any) => {
      // 존재 확인 (없어도 idempotent 하게 처리하려면 선택)
      const chk = await tx.execute(sql`
        SELECT 1
        FROM ${company_musics}
        WHERE company_id = ${companyId} AND music_id = ${musicId}
        LIMIT 1
      `);
  
      if (!chk?.rows?.length) {
        // 이미 제거됐거나 없으면 현재 me 상태만 반환(아이덤포턴트)
        return this.getMe(companyId);
        // 또는 에러 원하면:
        // throw new BadRequestException('이미 삭제되었거나 사용 중이 아닙니다.');
      }
  
      // 연결만 제거 (이력/리워드는 그대로 보존)
      await tx.execute(sql`
        DELETE FROM ${company_musics}
        WHERE company_id = ${companyId} AND music_id = ${musicId}
      `);
  
      // 최신 마이페이지 오버뷰 반환
      return this.getMe(companyId);
    });
  }
}
