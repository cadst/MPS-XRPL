import 'dotenv/config'
import { db, pool } from '../db/client'
import { monthly_music_rewards, musics } from '../db/schema'
import { sql } from 'drizzle-orm'

type MMRInsert = typeof monthly_music_rewards.$inferInsert

const YM_LIST = [
    '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08'
]

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randFloat(min: number, max: number, digits = 3) {
    const v = Math.random() * (max - min) + min
    return Number(v.toFixed(digits))
}

async function main() {
    const musicRows = await db.select().from(musics)
    if (musicRows.length === 0) {
        console.log('No musics found. Nothing to seed.')
        return
    }

    // Clean existing rows for target months
    await db.execute(sql`DELETE FROM monthly_music_rewards WHERE year_month IN (${sql.join(YM_LIST, sql`,`)})`)

    const batch: MMRInsert[] = []

    for (const ym of YM_LIST) {
        // Shuffle musics indices to vary rewarded set month-to-month
        const idxs = [...musicRows.keys()]
        for (let i = idxs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
                ;[idxs[i], idxs[j]] = [idxs[j], idxs[i]]
        }
        const half = Math.floor(musicRows.length / 2)
        const noRewardSet = new Set(idxs.slice(0, half))
        const rewardSet = idxs.slice(half)

        // Among rewarded, half have remaining 0 (fully consumed)
        const halfRewarded = Math.floor(rewardSet.length / 2)
        const consumedSet = new Set(rewardSet.slice(0, halfRewarded))

        for (let k = 0; k < musicRows.length; k++) {
            const m = musicRows[k]
            if (noRewardSet.has(k)) {
                batch.push({
                    music_id: m.id as any,
                    year_month: ym,
                    total_reward_count: 0,
                    remaining_reward_count: 0,
                    reward_per_play: 0 as any,
                    is_auto_reset: true,
                })
            } else {
                const total = randInt(1000, 10000)
                const remaining = consumedSet.has(k) ? 0 : randInt(0, total - 1)
                batch.push({
                    music_id: m.id as any,
                    year_month: ym,
                    total_reward_count: total,
                    remaining_reward_count: remaining,
                    reward_per_play: randFloat(0.01, 2.0) as any,
                    is_auto_reset: true,
                })
            }
        }
    }

    // Bulk insert
    if (batch.length) {
        await db.insert(monthly_music_rewards).values(batch)
    }

    console.log(`✅ Seeded monthly_music_rewards for ${YM_LIST.length} months, rows: ${batch.length}`)
}

main()
    .catch((e) => {
        console.error('❌ seed-monthly-music-rewards failed:', e)
        process.exitCode = 1
    })
    .finally(async () => {
        await pool.end()
    })
