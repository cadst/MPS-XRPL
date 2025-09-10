import 'dotenv/config'
import { db, pool } from '../db/client'
import { music_plays } from '../db/schema'

async function main() {
	// 설정: 최근 N개월, 회사/음원/타입 비율, 리워드 범위
	const companyIds = [1, 2, 3]
	const musicIds = [18, 19, 20, 21, 22, 23, 24, 25]
	const monthsBack = Number(process.env.SEED_MONTHS ?? 12)
	const musicRatio = Number(process.env.SEED_MUSIC_RATIO ?? 0.6) // 음악 호출 비율
	const lyricsRatio = 1 - musicRatio
	const tzOffsetMs = 9 * 3600 * 1000 // KST
	const now = new Date()
	const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
	const deleteSince = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - (monthsBack - 1), 1))

	// 기존 더미 삭제: 대상 회사의 최근 N개월 범위만 정리
	await db.execute(`DELETE FROM music_plays WHERE using_company_id IN (${companyIds.join(',')}) AND created_at >= '${deleteSince.toISOString()}'`)
	await db.execute(`DELETE FROM company_musics WHERE company_id IN (${companyIds.join(',')})`)

	// company_musics 매핑 복구 (회사-음원 전체 매핑)
	for (const companyId of companyIds) {
		for (const musicId of musicIds) {
			await db.execute(
				`INSERT INTO company_musics (company_id, music_id)
				 SELECT ${companyId}, ${musicId}
				 WHERE NOT EXISTS (
				   SELECT 1 FROM company_musics WHERE company_id=${companyId} AND music_id=${musicId}
				 )`
			)
		}
	}

	function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
	function chooseUseCase() {
		return Math.random() < musicRatio ? 'music' : 'lyrics'
	}
	// DB enum 매핑: reward_code/use_case가 '0','1','2' 형태로 정의됨
	// 가정: 0=음원호출, 1=가사호출 (필요시 실제 매핑에 맞게 조정)
	const ENUM_USECASE_MUSIC = '0'
	const ENUM_USECASE_LYRICS = '2'
	const ENUM_REWARD_MUSIC = '0'
	const ENUM_REWARD_LYRICS = '1'

	function rewardCodeByUseCase(useCase: 'music' | 'lyrics') {
		return useCase === 'music' ? ENUM_REWARD_MUSIC : ENUM_REWARD_LYRICS
	}
	function useCaseEnumValue(useCase: 'music' | 'lyrics') {
		return useCase === 'music' ? ENUM_USECASE_MUSIC : ENUM_USECASE_LYRICS
	}
	function rewardByUseCase(useCase: 'music' | 'lyrics', mul: number) {
		const base = useCase === 'music' ? 0.008 : 0.005
		const jitter = useCase === 'music' ? 0.004 : 0.003
		return Number(((base + Math.random() * jitter) * mul).toFixed(3))
	}

	// 회사별 일일 호출 스케일 (평균 차이를 내기 위해 계수 다르게)
	const scaleByCompany: Record<number, { min: number; max: number; rewardMul: number }> = {
		1: { min: 40, max: 70, rewardMul: 1.0 },   // 높은 트래픽
		2: { min: 20, max: 40, rewardMul: 0.85 }, // 중간 트래픽, 리워드 약간 낮게
		3: { min: 8,  max: 18, rewardMul: 0.7 },  // 낮은 트래픽, 리워드 더 낮게
	}

	for (let i = monthsBack - 1; i >= 0; i--) {
		const monthStart = new Date(anchor)
		monthStart.setUTCMonth(anchor.getUTCMonth() - i)
		const nextMonth = new Date(monthStart)
		nextMonth.setUTCMonth(monthStart.getUTCMonth() + 1)

		for (let d = new Date(monthStart); d < nextMonth; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
			for (const companyId of companyIds) {
				const scale = scaleByCompany[companyId]
				const plays = randInt(scale.min, scale.max)
				for (let k = 0; k < plays; k++) {
					const musicId = musicIds[randInt(0, musicIds.length - 1)]
					const sec = randInt(0, 86399)
					const ts = new Date(d.getTime() + sec * 1000 + tzOffsetMs)
					const useCaseRaw = chooseUseCase() as 'music' | 'lyrics'
					const reward = rewardByUseCase(useCaseRaw, scale.rewardMul)
					const rewardCode = rewardCodeByUseCase(useCaseRaw)
					const useCaseEnum = useCaseEnumValue(useCaseRaw)
					const duration = randInt(45, 240)

					await db.insert(music_plays).values({
						music_id: musicId,
						using_company_id: companyId,
						is_valid_play: true,
						reward_amount: reward as any,
						reward_code: rewardCode as any, // enum reward_code '0'|'1'
						use_case: useCaseEnum as any,   // enum use_case '0'|'1'
						use_price: 0.01 as any,
						play_duration_sec: duration,
						created_at: ts as any,
					})
				}
			}
		}
	}

	console.log(`Seed completed: ${monthsBack} months, ratio music:${musicRatio} lyrics:${lyricsRatio}`)
}

main().then(() => pool.end()).catch((e) => { console.error(e); pool.end(); process.exit(1) }) 