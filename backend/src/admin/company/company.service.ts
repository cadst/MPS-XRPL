import { Injectable, Inject } from '@nestjs/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import type { DB } from '../../db/client';
import { sql } from 'drizzle-orm';
import type { RewardsSummaryQueryDto } from './dto/rewards-summary.query.dto';
import { getDefaultYearMonthKST, isValidYearMonth, resolveYearMonthKST } from '../../common/utils/date.util';
import { normalizePagination } from '../../common/utils/pagination.util';
import { normalizeSort } from '../../common/utils/sort.util';
import { buildSummaryQuery, buildDailyQuery, buildByMusicQuery, buildSummaryListBaseQuery, buildDailyIndustryAvgQuery, buildMonthlyCompanyQuery, buildMonthlyIndustryAvgQuery } from './queries/rewards.queries';
import { buildRenewalStatsQuery, buildHourlyValidPlaysQuery, buildTierDistributionQuery, buildRevenueCalendarQuery, buildRevenueTrendsQuery, buildRevenueCompaniesQuery, buildRevenueCompaniesCumulativeQuery } from './queries/stats.queries';
import { RevenueCalendarQueryDto, RevenueCalendarResponseDto, RevenueCalendarDayDto } from './dto/revenue-calendar.dto';
import { RevenueTrendsQueryDto, RevenueTrendsResponseDto, RevenueTrendsItemDto } from './dto/revenue-trends.dto';
import { RevenueCompaniesQueryDto, RevenueCompaniesResponseDto, RevenueCompaniesItemDto } from './dto/revenue-companies.dto';
import { CompanyTotalStatsQueryDto, CompanyTotalStatsResponseDto } from './dto/company-stats.dto';
import { APP_CONFIG } from '../../config/app.config';
import { RenewalStatsQueryDto, RenewalStatsResponseDto } from './dto/renewal-stats.dto';
import { HourlyPlaysQueryDto, HourlyPlaysResponseDto } from './dto/hourly-plays.dto';
import { TierDistributionQueryDto, TierDistributionResponseDto } from './dto/tier-distribution.dto';
import { buildDayRangeCTE } from '../../common/utils/date.util';

@Injectable()
export class CompanyService {
  constructor(@Inject('DB') private readonly db: DB) {}

  async getRewardsSummary(params: RewardsSummaryQueryDto) {
    const tz = 'Asia/Seoul';

    const yearMonth = isValidYearMonth(params.yearMonth) ? params.yearMonth! : getDefaultYearMonthKST();
    const [ymYear, ymMonth] = yearMonth.split('-').map(Number);

    const { page, limit, offset } = normalizePagination(params.page, params.limit, 100);

    const search = (params.search || '').trim();
    const hasSearch = search.length > 0;
    const tier = params.tier && params.tier !== 'all' ? params.tier : null;

    const { sortBy, order } = normalizeSort(
      params.sortBy,
      params.order,
      ['company_id', 'name', 'grade', 'total_tokens', 'monthly_earned', 'monthly_used', 'usage_rate', 'active_tracks']
    );

    const baseQuery = buildSummaryListBaseQuery(ymYear, ymMonth, tz);
    const filtered = sql`${baseQuery}
      ${hasSearch ? sql`AND (c.name ILIKE ${'%' + search + '%'} OR CAST(c.id AS TEXT) ILIKE ${'%' + search + '%'})` : sql``}
      ${tier ? sql`AND c.grade = ${tier}` : sql``}
    `;

    const totalResult = await this.db.execute(sql`SELECT COUNT(*) as count FROM (${filtered}) t`);
    const totalRows = (totalResult as any).rows ?? [];
    const total = Number(totalRows[0]?.count ?? 0);

    const pageResult = await this.db.execute(sql`${filtered} ORDER BY ${sql.raw(sortBy)} ${sql.raw(order)} LIMIT ${limit} OFFSET ${offset}`);
    const rows = (pageResult as any).rows ?? [];

    const items = rows.map((r: any) => ({
      companyId: Number(r.company_id),
      name: r.name as string,
      tier: String(r.grade),
      totalTokens: Number(r.total_tokens ?? 0),
      monthlyEarned: Number(r.monthly_earned ?? 0),
      monthlyUsed: Number(r.monthly_used ?? 0),
      usageRate: Number(r.usage_rate ?? 0),
      activeTracks: Number(r.active_tracks ?? 0),
      action: 'detail',
    }));

    return { items, page, limit, total, yearMonth };
  }

  async getRewardsDetail(companyId: number, yearMonth?: string) {
    const tz = 'Asia/Seoul'
    const ym = resolveYearMonthKST(yearMonth)
    const [ymYear, ymMonth] = ym.split('-').map(Number)

    const summaryRes = await this.db.execute(buildSummaryQuery(companyId, ymYear, ymMonth, tz))
    const base = (summaryRes as any).rows?.[0]
    if (!base) {
      return { company: { id: companyId, name: '', tier: 'free' }, summary: { totalTokens: 0, monthlyEarned: 0, monthlyUsed: 0, usageRate: 0, activeTracks: 0, yearMonth: ym }, daily: [], dailyIndustryAvg: [], monthly: [], monthlyIndustryAvg: [], byMusic: [] }
    }

    const [dailyRes, dailyIndustryRes, byMusicRes, monthlyCompanyRes, monthlyIndustryRes] = await Promise.all([
      this.db.execute(buildDailyQuery(companyId, ymYear, ymMonth, tz)),
      this.db.execute(buildDailyIndustryAvgQuery(ymYear, ymMonth, tz)),
      this.db.execute(buildByMusicQuery(companyId, ymYear, ymMonth, tz)),
      this.db.execute(buildMonthlyCompanyQuery(companyId, ymYear, ymMonth, 12, tz)),
      this.db.execute(buildMonthlyIndustryAvgQuery(ymYear, ymMonth, 12, tz)),
    ])

    const tierText = String(base.grade) === 'business' ? 'Business' : String(base.grade) === 'standard' ? 'Standard' : 'Free'

    const fmt = (d?: any) => (d ? new Date(d).toISOString().slice(0, 10) : undefined)

    return {
      company: {
        id: Number(base.company_id),
        name: base.name,
        tier: tierText,
        businessNumber: base.business_number,
        contactEmail: base.email,
        contactPhone: base.phone,
        homepageUrl: base.homepage_url,
        profileImageUrl: base.profile_image_url,
        smartAccountAddress: base.smart_account_address,
        ceoName: base.ceo_name,
        createdAt: fmt(base.created_at),
        updatedAt: fmt(base.updated_at),
        subscriptionStart: fmt(base.subscription_start),
        subscriptionEnd: fmt(base.subscription_end),
      },
      summary: {
        totalTokens: Number(base.total_tokens || 0),
        monthlyEarned: Number(base.monthly_earned || 0),
        monthlyUsed: Number(base.monthly_used || 0),
        usageRate: Number(base.usage_rate || 0),
        activeTracks: Number(base.active_tracks || 0),
        yearMonth: ym,
        earnedTotal: Number(base.earned_total || 0),
        usedTotal: Number(base.used_total || 0),
      },
      daily: ((dailyRes as any).rows || []).map((r: any) => ({ date: r.date, earned: Number(r.earned || 0), used: Number(r.used || 0) })),
      dailyIndustryAvg: ((dailyIndustryRes as any).rows || []).map((r: any) => ({ date: r.date, earned: Number(r.earned || 0) })),
      monthly: ((monthlyCompanyRes as any).rows || []).map((r: any) => ({ yearMonth: r.year_month, earned: Number(r.earned || 0) })),
      monthlyIndustryAvg: ((monthlyIndustryRes as any).rows || []).map((r: any) => ({ yearMonth: r.year_month, earned: Number(r.earned || 0) })),
      byMusic: ((byMusicRes as any).rows || []).map((r: any) => ({ musicId: Number(r.music_id), title: r.title, artist: r.artist, category: r.category ?? null, musicCalls: Number(r.music_calls || 0), lyricsCalls: Number(r.lyrics_calls || 0), earned: Number(r.earned || 0), lastUsedAt: r.last_used_at || null })),
    }
  }

  create(createCompanyDto: CreateCompanyDto) {
    return 'This action adds a new company';
  }

  findAll() {
    return `This action returns all company`;
  }

  findOne(id: number) {
    return `This action returns a #${id} company`;
  }

  update(id: number, updateCompanyDto: UpdateCompanyDto) {
    return `This action updates a #${id} company`;
  }

  remove(id: number) {
    return `This action removes a #${id} company`;
  }

  async getTotalCount(query: CompanyTotalStatsQueryDto): Promise<CompanyTotalStatsResponseDto> {
    const ym = query.yearMonth ?? getDefaultYearMonthKST()
    const [y, m] = ym.split('-').map(Number)
    const endTsSql = sql`
      (make_timestamptz(${y}, ${m}, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second'
    `
    const q = sql`SELECT COUNT(*)::int AS total FROM companies c WHERE c.created_at <= ${endTsSql}`
    const res = await this.db.execute(q as any)
    const total = Number((res as any).rows?.[0]?.total ?? 0)
    return { total, asOf: ym }
  }

  async getRenewalStats(query: RenewalStatsQueryDto): Promise<RenewalStatsResponseDto> {
    const tz = 'Asia/Seoul'
    const ym = resolveYearMonthKST(query.yearMonth)
    const [y, m] = ym.split('-').map(Number)
    const prevY = m === 1 ? y - 1 : y
    const prevM = m === 1 ? 12 : (m - 1)

    const q = buildRenewalStatsQuery(y, m, tz)
    const res = await this.db.execute(q as any)
    const row = (res as any).rows?.[0] || {}
    const prevActive = Number(row.prev_active || 0)
    const currActive = Number(row.curr_active || 0)
    const retained = Number(row.retained || 0)
    const churned = Number(row.churned || 0)
    const reactivated = Number(row.reactivated || 0)
    const rate = prevActive > 0 ? Math.round((retained / prevActive) * 100) : null
    return { asOf: ym, prevActive, currActive, retained, churned, reactivated, rate }
  }

  async getHourlyValidPlays(query: HourlyPlaysQueryDto): Promise<HourlyPlaysResponseDto> {
    const tz = 'Asia/Seoul'
    const toDate = (s?: string) => {
      if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s
      const now = new Date()
      const kst = new Date(now.getTime() + 9 * 3600 * 1000)
      const y = kst.getUTCFullYear()
      const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
      const d = String(kst.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    const date = toDate(query.date)
    const [y, m, d] = date.split('-').map(Number)

    const q = buildHourlyValidPlaysQuery(y, m, d, tz)
    const res = await this.db.execute(q as any)
    const rows = (res as any).rows || []
    const labels = rows.map((r: any) => `${Number(r.h)}시`)
    const free = rows.map((r: any) => ({
      total: Number(r.free_total || 0),
      valid: Number(r.free_valid || 0),
      lyrics: Number(r.free_lyrics || 0)
    }))
    const standard = rows.map((r: any) => ({
      total: Number(r.standard_total || 0),
      valid: Number(r.standard_valid || 0),
      lyrics: Number(r.standard_lyrics || 0)
    }))
    const business = rows.map((r: any) => ({
      total: Number(r.business_total || 0),
      valid: Number(r.business_valid || 0),
      lyrics: Number(r.business_lyrics || 0)
    }))
    const prevAvg = rows.map((r: any) => Number(r.prev_avg || 0))
    return { date, labels, free, standard, business, prevAvg }
  }

  async getTierDistribution(query: TierDistributionQueryDto): Promise<TierDistributionResponseDto> {
    const tz = 'Asia/Seoul'
    const ym = resolveYearMonthKST(query.yearMonth)
    const [y, m] = ym.split('-').map(Number)

    const q = buildTierDistributionQuery(y, m, tz)
    const res = await this.db.execute(q as any)
    const row = (res as any).rows?.[0] || {}
    const free = Number(row.free || 0)
    const standard = Number(row.standard || 0)
    const business = Number(row.business || 0)
    const total = Number(row.total || 0)
    return { yearMonth: ym, free, standard, business, total }
  }

  async getRevenueCalendar(query: RevenueCalendarQueryDto): Promise<RevenueCalendarResponseDto> {
    const ym = resolveYearMonthKST(query.yearMonth)
    const [y, m] = ym.split('-').map(Number)
    const tz = 'Asia/Seoul'

    const q = buildRevenueCalendarQuery(y, m, tz)
    const res = await this.db.execute(q)
    const rows = (res.rows || []) as any[]
    
    const days: RevenueCalendarDayDto[] = rows.map((r: any) => ({
      date: r.date || '',
      subscriptionRevenue: Number(r.subscription_revenue || 0),
      usageRevenue: Number(r.usage_revenue || 0),
      totalRevenue: Number(r.total_revenue || 0),
    }))

    const monthlySummary = {
      subscriptionRevenue: days.reduce((sum, day) => sum + day.subscriptionRevenue, 0),
      usageRevenue: days.reduce((sum, day) => sum + day.usageRevenue, 0),
      totalRevenue: days.reduce((sum, day) => sum + day.totalRevenue, 0),
    }

    return { yearMonth: ym, days, monthlySummary }
  }

  async getRevenueTrends(query: RevenueTrendsQueryDto): Promise<RevenueTrendsResponseDto> {
    const startYear = query.year ?? 2024
    const startMonth = 10
    const months = Math.min(Math.max(query.months ?? 15, 1), 24)

    const q = buildRevenueTrendsQuery(startYear, startMonth, months)
    const res = await this.db.execute(q)
    const rows = (res.rows || []) as any[]
    
    const items: RevenueTrendsItemDto[] = rows.map((r: any) => {
      const standardSub = Number(r.standard_subscription || 0)
      const businessSub = Number(r.business_subscription || 0)
      const generalUsage = Number(r.general_usage || 0)
      const lyricsUsage = Number(r.lyrics_usage || 0)
      const instrumentalUsage = Number(r.instrumental_usage || 0)
      
      const year = r.year || APP_CONFIG.REVENUE.DEFAULT_START_YEAR + 1
      const monthNum = r.month || 1
      const monthLabel = year === APP_CONFIG.REVENUE.DEFAULT_START_YEAR ? `${monthNum}월(24)` : `${monthNum}월`
      
      return {
        month: monthLabel,
        subscriptionRevenue: {
          standard: standardSub,
          business: businessSub,
          total: standardSub + businessSub,
        },
        usageRevenue: {
          general: generalUsage,
          lyrics: lyricsUsage,
          instrumental: instrumentalUsage,
          total: generalUsage + lyricsUsage + instrumentalUsage,
        },
        totalRevenue: standardSub + businessSub + generalUsage + lyricsUsage + instrumentalUsage,
      }
    })

    return { year: startYear, items }
  }

  async getRevenueCompanies(query: RevenueCompaniesQueryDto): Promise<RevenueCompaniesResponseDto> {
    const grade = query.grade || 'standard'
    const limit = Math.min(Math.max(query.limit ?? 5, 1), 20)

    // 누적 구독료만으로 랭킹
    const q = buildRevenueCompaniesCumulativeQuery(grade, limit)
    const res = await this.db.execute(q)
    const rows = (res.rows || []) as any[]
    
    const items: RevenueCompaniesItemDto[] = rows.map((r: any) => ({
      rank: Number(r.rank || 0),
      companyId: Number(r.company_id || 0),
      companyName: r.company_name || 'Unknown',
      grade: r.grade || grade,
      subscriptionRevenue: Number(r.subscription_revenue || 0),
      usageRevenue: Number(r.usage_revenue || 0),
      totalRevenue: Number(r.total_revenue || 0),
      percentage: Number(r.percentage || 0),
      growth: '+0.0%', // TODO: 전월 대비 계산
    }))

    // 누적 랭킹이므로 yearMonth는 생략 가능하지만, 프론트 호환을 위해 현재 월을 반환
    const now = new Date()
    const ymStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    return { yearMonth: ymStr, grade, items }
  }
}
