import 'dotenv/config'
import { db, pool } from '../db/client'
import { companies, company_subscriptions } from '../db/schema'
import { eq, inArray, sql } from 'drizzle-orm'

function startOfUtcMonth(d: Date) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0))
}
function endOfUtcMonth(d: Date) {
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0))
    return new Date(next.getTime() - 1000) // last second of month
}
function monthsBetweenInclusive(from: Date, to: Date, randomDayFn: (month: Date) => number) {
    const out: { start: Date; end: Date }[] = []
    let cur = startOfUtcMonth(from)
    const end = startOfUtcMonth(to)
    while (cur <= end) {
        // pick a random day for this month
        const day = randomDayFn(cur)
        // ensure day is valid for month
        const maxDay = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0)).getUTCDate()
        const safeDay = Math.min(day, maxDay)
        const start = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), safeDay, Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60)))
        // end_date: one month later, same day (or last day if overflow)
        let endMonth = cur.getUTCMonth() + 1
        let endYear = cur.getUTCFullYear()
        if (endMonth > 11) { endMonth = 0; endYear++ }
        const endMaxDay = new Date(Date.UTC(endYear, endMonth + 1, 0)).getUTCDate()
        const endDay = Math.min(safeDay, endMaxDay)
        const end = new Date(Date.UTC(endYear, endMonth, endDay, 23, 59, 59))
        out.push({ start, end })
        cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))
    }
    return out
}

function pickRandomStartMonth(baseFrom: Date, upTo: Date) {
    // choose a random month between baseFrom and upTo
    const from = startOfUtcMonth(baseFrom)
    const end = startOfUtcMonth(upTo)
    const totalMonths = (end.getUTCFullYear() - from.getUTCFullYear()) * 12 + (end.getUTCMonth() - from.getUTCMonth())
    const offset = Math.floor(Math.random() * (totalMonths + 1))
    return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + offset, 1))
}

function pricingForTier(tier: 'standard' | 'business' | 'free') {
    if (tier === 'business') {
        const base = 29000
        const discount = 0
        const actual = base - discount
        return { base, discount, actual }
    }
    if (tier === 'standard') {
        const base = 19000
        const discount = 0
        const actual = base - discount
        return { base, discount, actual }
    }
    return { base: 0, discount: 0, actual: 0 }
}

async function main() {
    const baseFrom = new Date(Date.UTC(2024 + 1, 0, 1)) // 2025-01-01 UTC
    const now = new Date()
    const currentMonthStart = startOfUtcMonth(now)

    const companyRows = await db.select().from(companies)

    // Non-free companies must have an active subscription covering now
    const nonFree = companyRows.filter((c) => c.grade !== 'free')
    const free = companyRows.filter((c) => c.grade === 'free')

    if (nonFree.length === 0) {
        console.log('No non-free companies found. Nothing to seed.')
        return
    }

    const nonFreeIds = nonFree.map((c) => c.id)

    // Remove existing subs since 2025-01-01 for targeted companies to avoid duplication
    await db.execute(
        sql`DELETE FROM company_subscriptions WHERE company_id IN (${sql.join(nonFreeIds, sql`,`)}) AND end_date >= ${baseFrom}`
    )

    type Row = typeof company_subscriptions.$inferInsert
    const rows: Row[] = []

    for (const c of nonFree) {
        const tier = c.grade as 'standard' | 'business'
        // choose random start month between 2025-01 and current month
        const randomStartMonth = pickRandomStartMonth(baseFrom, now)
        // build full month chain up to the current month inclusive (ensures active coverage)
        // randomize day-of-month for each company
        const baseDay = Math.floor(Math.random() * 28) + 1 // 1~28
        const months = monthsBetweenInclusive(randomStartMonth, currentMonthStart, () => baseDay)
        for (const m of months) {
            const price = pricingForTier(tier)
            rows.push({
                company_id: c.id as any,
                tier,
                start_date: m.start as any,
                end_date: m.end as any,
                total_paid_amount: price.base as any,
                payment_count: 1,
                discount_amount: price.discount as any,
                actual_paid_amount: price.actual as any,
                created_at: m.start as any,
                updated_at: m.start as any,
            })
        }
    }

    // Optionally, add occasional free-tier rows (not required for permission check).
    // Skipped by default to keep data clean.

    if (rows.length) {
        await db.insert(company_subscriptions).values(rows)
    }

    console.log(`✅ Seeded company_subscriptions for ${nonFree.length} companies, rows: ${rows.length}`)
}

main()
    .catch((e) => {
        console.error('❌ seed-company-subscriptions failed:', e)
        process.exitCode = 1
    })
    .finally(async () => {
        await pool.end()
    })
