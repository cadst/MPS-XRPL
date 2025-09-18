import 'dotenv/config'
import { db, pool } from '../db/client'
import { companies } from '../db/schema'
import type { InferInsertModel } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

type NewCompany = InferInsertModel<typeof companies>

function randomDate(from: Date, to: Date) {
    const fromMs = from.getTime()
    const toMs = to.getTime()
    const rnd = fromMs + Math.random() * (toMs - fromMs)
    return new Date(rnd)
}

function pad(n: number, len = 2) {
    return n.toString().padStart(len, '0')
}

function makeBusinessNumber(i: number) {
    // Simple deterministic unique-like number: 110-XX-YYYYY
    const mid = pad((i % 90) + 10) // 10-99
    const tail = pad(10000 + i, 5)
    return `110-${mid}-${tail}`
}

// Realistic Korean-style company name generator
const KR_BRANDS = [
    '한빛', '누리', '가온', '이룸', '라온', '다온', '한결', '바람', '새봄', '별빛',
    '해솔', '온새미로', '맑음', '푸름', '나래', '하늘', '모아', '도담', '다솜', '온기',
    '미르', '새결', '소담', '오름',
]
const KR_SUFFIXES = [
    '테크', '솔루션', '미디어', '바이오', '모빌리티', '네트웍스', '소프트', '디지털', '랩스', '스튜디오', '시스템', '엔지니어링', '커머스', '푸드', '에너지',
]
const KR_LEGAL = ['주식회사', '(주)', '유한회사'] as const

const EN_BRANDS = [
    'hanbit', 'nuri', 'gaon', 'eroom', 'laon', 'daon', 'hangyeol', 'baram', 'saebom', 'byeolbit',
    'haesol', 'onsaemiro', 'malgeum', 'pureum', 'narae', 'haneul', 'moa', 'dodam', 'dasom', 'ongi',
    'mir', 'saegyeol', 'sodam', 'oreum',
]
const EN_SUFFIXES = [
    'tech', 'solutions', 'media', 'bio', 'mobility', 'networks', 'soft', 'digital', 'labs', 'studio', 'systems', 'engineering', 'commerce', 'food', 'energy',
]

function buildCompanyNameAndSlug(index: number) {
    const bi = index % KR_BRANDS.length
    const si = index % KR_SUFFIXES.length
    const li = index % KR_LEGAL.length
    const brandKr = KR_BRANDS[bi]
    const suffixKr = KR_SUFFIXES[si]
    const brandEn = EN_BRANDS[bi]
    const suffixEn = EN_SUFFIXES[si]
    const legal = KR_LEGAL[li]
    // Randomly choose prefix or suffix legal form, but deterministically by index for stability
    const usePrefix = (index % 2) === 0
    const nameKr = usePrefix ? `${legal}${brandKr}${suffixKr}` : `${legal} ${brandKr}${suffixKr}`
    const slug = `${brandEn}-${suffixEn}-${pad(index + 1, 2)}`
    return { nameKr, slug }
}

async function main() {
    const baseFrom = new Date('2025-01-01T00:00:00+09:00')
    const now = new Date()

    // grades: free 5, standard 5, business 10
    const gradePlan = [
        ...Array(5).fill('free'),
        ...Array(5).fill('standard'),
        ...Array(10).fill('business'),
    ] as const

    // Shuffle slightly to avoid strict blocks by grade
    const grades = [...gradePlan].sort(() => Math.random() - 0.5)

    const passwordHash = bcrypt.hashSync('Passw0rd!', 10)

    const rows: NewCompany[] = grades.map((grade, idx) => {
        const n = idx + 1
        const createdAt = randomDate(baseFrom, now)
        const { nameKr, slug } = buildCompanyNameAndSlug(idx)
        const domain = `${slug}.example.com`
        return {
            name: nameKr,
            business_number: makeBusinessNumber(n),
            email: `info@${domain}`,
            password_hash: passwordHash,
            phone: `010-${pad(1000 + (n * 37) % 9000, 4)}-${pad(1000 + (n * 71) % 9000, 4)}`,
            grade: grade as any,
            ceo_name: `대표 ${pad(n, 2)}`,
            profile_image_url: null,
            homepage_url: `https://${domain}`,
            smart_account_address: null,
            api_key_hash: null,
            total_rewards_earned: '0' as any,
            total_rewards_used: '0' as any,
            created_at: createdAt as any,
            updated_at: createdAt as any,
        }
    })

    // Insert and ignore duplicates on unique columns (by name)
    await db
        .insert(companies)
        .values(rows)
        .onConflictDoNothing()

    console.log(`✅ Seeded companies: attempted ${rows.length}.`)
}

main()
    .catch((e) => {
        console.error('❌ seed-companies failed:', e)
        process.exitCode = 1
    })
    .finally(async () => {
        await pool.end()
    })
