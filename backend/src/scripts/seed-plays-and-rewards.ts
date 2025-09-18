import 'dotenv/config'
import { db, pool } from '../db/client'
import { companies, musics, music_plays, rewards, company_subscriptions } from '../db/schema'
import { sql } from 'drizzle-orm'

type Company = typeof companies.$inferSelect
type Music = typeof musics.$inferSelect
type PlayInsert = typeof music_plays.$inferInsert
type RewardInsert = typeof rewards.$inferInsert

const START_DATE = new Date(Date.UTC(2025, 0, 1, 0, 0, 0)) // 2025-01-01 UTC
const TOTAL_PLAYS = 50_000

function daysBetweenInclusive(from: Date, to: Date) {
    const out: Date[] = []
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
    const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
    while (d <= end) {
        out.push(new Date(d))
        d.setUTCDate(d.getUTCDate() + 1)
    }
    return out
}

function buildDailyWeights(days: Date[]) {
    // Random walk + weekly seasonality
    let level = 1
    const weights: number[] = []
    for (let i = 0; i < days.length; i++) {
        if (i % 7 === 0 && i > 0) {
            // weekly drift
            level *= 0.97 + Math.random() * 0.08 // ~0.97..1.05
            level = Math.max(0.2, Math.min(level, 3))
        }
        const weekday = days[i].getUTCDay() // 0..6
        const weekly = 1 + 0.15 * Math.sin((2 * Math.PI * weekday) / 7)
        const noise = 0.9 + Math.random() * 0.2
        weights.push(level * weekly * noise)
    }
    return weights
}

function splitTotalByWeights(total: number, weights: number[]) {
    const sum = weights.reduce((a, b) => a + b, 0)
    const raw = weights.map((w) => (w / sum) * total)
    const counts = raw.map((x) => Math.floor(x))
    let remaining = total - counts.reduce((a, b) => a + b, 0)
    // distribute remainders by largest fractional part
    const fracs = raw.map((x, i) => ({ i, f: x - Math.floor(x) }))
    fracs.sort((a, b) => b.f - a.f)
    for (let k = 0; k < remaining; k++) counts[fracs[k].i]++
    return counts
}

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickEnum<T extends string>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

async function main() {
    const now = new Date()
    // Use up to yesterday (exclude today)
    const yesterdayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    yesterdayUtc.setUTCDate(yesterdayUtc.getUTCDate() - 1)
    if (yesterdayUtc.getTime() < START_DATE.getTime()) {
        console.log('End date is before start date. Nothing to seed.')
        return
    }

    // Fetch existing companies and musics
    const [companyRows, musicRows] = await Promise.all([
        db.select().from(companies),
        db.select().from(musics),
    ])

    if (companyRows.length === 0) throw new Error('No companies found')
    if (musicRows.length === 0) throw new Error('No musics found')

    // Load subscriptions for non-free companies to validate play timestamps
    const nonFreeIds = companyRows.filter(c => c.grade !== 'free').map(c => c.id)
    const subsByCompany = new Map<number, { start: Date; end: Date }[]>()
    if (nonFreeIds.length) {
        const subRows = await db.select().from(company_subscriptions).where(sql`company_id IN (${sql.join(nonFreeIds, sql`,`)})`)
        for (const s of subRows) {
            const arr = subsByCompany.get(s.company_id as number) ?? []
            arr.push({ start: s.start_date as any, end: s.end_date as any })
            subsByCompany.set(s.company_id as number, arr)
        }
        // sort each by start
        for (const [k, arr] of subsByCompany) {
            arr.sort((a, b) => a.start.getTime() - b.start.getTime())
            subsByCompany.set(k, arr)
        }
    }

    const days = daysBetweenInclusive(START_DATE, yesterdayUtc)
    const weights = buildDailyWeights(days)
    const countsPerDay = splitTotalByWeights(TOTAL_PLAYS, weights)

    // For created_at uniqueness, ensure per-second uniqueness by nudging when colliding
    const usedSeconds = new Set<number>()

    const rewardCodes = ['0', '1', '2', '3'] as const
    const useCases = ['0', '1', '2'] as const

    const batchSize = 1000
    let totalCreated = 0

    // Utility: choose a company that is allowed for the timestamp
    function pickCompanyFor(ts: Date): Company {
        for (let tries = 0; tries < 20; tries++) {
            const c = companyRows[randInt(0, companyRows.length - 1)]
            if (c.grade === 'free') return c
            const subs = subsByCompany.get(c.id)
            if (!subs || subs.length === 0) continue
            const ok = subs.some(s => ts >= s.start && ts <= s.end)
            if (ok) return c
        }
        // Fallback: pick any free company
        const freeList = companyRows.filter(c => c.grade === 'free')
        return freeList.length ? freeList[randInt(0, freeList.length - 1)] : companyRows[0]
    }

    // Build all plays in memory iteratively but insert in batches
    const playsBuffer: PlayInsert[] = []
    const rewardBuffer: RewardInsert[] = []
    const playToRewardIndex: number[] = [] // index mapping from playsBuffer for valid ones

    for (let di = 0; di < days.length; di++) {
        const day = days[di]
        const count = countsPerDay[di]
        for (let i = 0; i < count; i++) {
            // Unique timestamp within the whole dataset
            let sec = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), randInt(0, 23), randInt(0, 59), randInt(0, 59)) / 1000
            while (usedSeconds.has(sec)) sec++
            usedSeconds.add(sec)
            const ts = new Date(sec * 1000)

            const comp = pickCompanyFor(ts)
            const music = musicRows[randInt(0, musicRows.length - 1)]

            const isValid = Math.random() < 0.8
            const duration = isValid ? randInt(60, 240) : randInt(5, 59)
            const isCurrentUtcMonth = ts.getUTCFullYear() === now.getUTCFullYear() && ts.getUTCMonth() === now.getUTCMonth()
            const rewardCode = (comp.grade === 'free' && isCurrentUtcMonth) ? '0' : pickEnum(rewardCodes)
            const useCase = pickEnum(useCases)
            const rewardAmount = (Math.random() * (2 - 0.01) + 0.01).toFixed(3)
            const usePrice = randInt(1, 10)

            const play: PlayInsert = {
                music_id: music.id as any,
                using_company_id: comp.id as any,
                reward_amount: rewardAmount as any,
                created_at: ts as any,
                updated_at: ts as any,
                transaction_hash: null,
                reward_code: rewardCode as any,
                use_case: useCase as any,
                use_price: usePrice as any,
                is_valid_play: isValid,
                play_duration_sec: duration,
            }
            playsBuffer.push(play)
            if (isValid) {
                playToRewardIndex.push(playsBuffer.length - 1)
            }

            // Flush in batches
            if (playsBuffer.length === batchSize) {
                await db.transaction(async (tx) => {
                    const inserted = await tx.insert(music_plays).values(playsBuffer).returning({ id: music_plays.id })
                    const rewardRows: RewardInsert[] = []
                    for (const idx of playToRewardIndex) {
                        const ins = inserted[idx - (inserted.length - playsBuffer.length)] // map local index
                        const playRow = playsBuffer[idx]
                        rewardRows.push({
                            company_id: playRow.using_company_id as any,
                            music_id: playRow.music_id as any,
                            play_id: ins.id as any,
                            reward_code: playRow.reward_code as any,
                            amount: playRow.reward_amount as any,
                            // status defaults to pending
                            payout_tx_hash: null,
                            block_number: null as any,
                            gas_used: null as any,
                            blockchain_recorded_at: null as any,
                            created_at: playRow.created_at as any,
                            updated_at: playRow.updated_at as any,
                        })
                    }
                    if (rewardRows.length) {
                        await tx.insert(rewards).values(rewardRows)
                    }
                })
                totalCreated += playsBuffer.length
                playsBuffer.length = 0
                rewardBuffer.length = 0
                playToRewardIndex.length = 0
            }
        }
    }

    // Flush remainder
    if (playsBuffer.length) {
        await db.transaction(async (tx) => {
            const inserted = await tx.insert(music_plays).values(playsBuffer).returning({ id: music_plays.id })
            const rewardRows: RewardInsert[] = []
            for (const idx of playToRewardIndex) {
                const ins = inserted[idx - (inserted.length - playsBuffer.length)]
                const playRow = playsBuffer[idx]
                rewardRows.push({
                    company_id: playRow.using_company_id as any,
                    music_id: playRow.music_id as any,
                    play_id: ins.id as any,
                    reward_code: playRow.reward_code as any,
                    amount: playRow.reward_amount as any,
                    payout_tx_hash: null,
                    block_number: null as any,
                    gas_used: null as any,
                    blockchain_recorded_at: null as any,
                    created_at: playRow.created_at as any,
                    updated_at: playRow.updated_at as any,
                })
            }
            if (rewardRows.length) {
                await tx.insert(rewards).values(rewardRows)
            }
        })
        totalCreated += playsBuffer.length
    }

    console.log(`✅ Seeded music_plays: ${totalCreated}. Rewards created for valid plays.`)
}

main()
    .catch((e) => {
        console.error('❌ seed-plays-and-rewards failed:', e)
        process.exitCode = 1
    })
    .finally(async () => {
        await pool.end()
    })
