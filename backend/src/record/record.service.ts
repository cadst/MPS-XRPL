import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lt, count, sql, desc, isNull } from 'drizzle-orm';
import { companies, musics, music_plays, company_subscriptions, monthly_music_rewards, rewards } from '../db/schema';

@Injectable()
export class RecordService {
    constructor(
        @Inject('DB') private db: NodePgDatabase<any>,
    ) { }

    private async getSmartAccount(companyId) {
        return await this.db
            .select({ smartAccount: companies.smart_account_address })
            .from(companies)
            .where(eq(companies.id, companyId));
    }

    // 하루 동안 기록된 음원 사용내역 조회. status가 pending인 기록만 조회함 
    async getDailyUsage() {
        const date = new Date();

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const result = await this.db
            .select({
                smartAccountAddress: companies.smart_account_address,
                musicId: rewards.music_id,
                playId: rewards.play_id,
                rewardCode: rewards.reward_code,
                usedAt: rewards.created_at,
            })
            .from(rewards)
            .leftJoin(companies, eq(rewards.company_id, companies.id))
            .where(
                and(
                    gte(rewards.created_at, startOfDay),
                    lt(rewards.created_at, endOfDay),
                    eq(rewards.status, 'pending')
                )
            )

        return result;
    }


    // 특정 상태의 하루 동안 기록된 음원 사용내역 조회
    async getDailyUsageByStatus(status: 'pending' | 'successed' | 'falied', targetDate?: Date) {
        const date = targetDate || new Date();

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const result = await this.db
            .select({
                companyId: rewards.company_id,
                musicId: rewards.music_id,
                playId: rewards.play_id,
                rewardCode: rewards.reward_code,
                usedAt: rewards.created_at,
                status: rewards.status,
                amount: rewards.amount,
                smartAccountAddress: companies.smart_account_address
            })
            .from(rewards)
            .leftJoin(companies, eq(rewards.company_id, companies.id))
            .where(
                and(
                    gte(rewards.created_at, startOfDay),
                    lt(rewards.created_at, endOfDay),
                    eq(rewards.status, status as any),
                    isNull(rewards.payout_tx_hash)
                )
            )
            .orderBy(desc(rewards.created_at));
        console.log(result, "getDailyUsageByStatus로 조회한 하루치 유효재생")
        return result;
    }

    // 리워드 상태 업데이트 (블록체인 전송 후)
    async updateRewardStatus(playId: number, txHash: string | null, status: 'successed' | 'falied' | 'pending', gasUsed?, blockNumber?: number) {
        try {
            const updateData: any = {
                status: status,
                updated_at: new Date()
            };

            const updateData2 = {
                transaction_hash: txHash
            }

            if (txHash) {
                updateData.payout_tx_hash = txHash;
                updateData.blockchain_recorded_at = new Date();
                updateData.gas_used = gasUsed;
                updateData.block_number = blockNumber;
                updateData2.transaction_hash = txHash;
            }

            await this.db
                .update(rewards)
                .set(updateData)
                .where(eq(rewards.play_id, playId));

            await this.db
                .update(music_plays)
                .set(updateData2)
                .where(eq(music_plays.id, playId));

            console.log(`리워드(기록레코드) 상태 업데이트 완료: Play ID ${playId}, Status: ${status}`);
        } catch (error) {
            console.error('리워드 상태 업데이트 실패:', error);
            throw error;
        }
    }

    // 일일 리워드 집계 (회사별)
    async getDailyRewardAggregation(targetDate?: Date) {
        const date = targetDate || new Date();

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const result = await this.db
            .select({
                companyId: rewards.company_id,
                smartAccountAddress: companies.smart_account_address,
                totalRewardAmount: sql<number>`SUM(${rewards.amount})`.as('totalRewardAmount'),
                rewardCount: count(rewards.id).as('rewardCount')
            })
            .from(rewards)
            .leftJoin(companies, eq(rewards.company_id, companies.id))
            .where(
                and(
                    gte(rewards.created_at, startOfDay),
                    lt(rewards.created_at, endOfDay),
                    eq(rewards.reward_code, "1"), // reward_code가 1인 경우만
                    eq(rewards.status, 'pending')
                )
            )
            .groupBy(rewards.company_id, companies.smart_account_address)
            .having(sql`SUM(${rewards.amount}) > 0`);

        console.log(result, "하루치 리워드 집계 결과일반")
        return result;
    }

    // 리워드 배치 상태 업데이트
    async updateRewardBatchStatus(playIds, txHash: string, status: 'successed' | 'falied', gasUsed, blockNumber: number) {
        try {
            const updateData: any = {
                status: status,
                updated_at: new Date()
            };

            const updateData2 = {
                transaction_hash: txHash
            };

            if (txHash) {
                updateData.payout_tx_hash = txHash;
                updateData.blockchain_recorded_at = new Date();
                updateData.gas_used = gasUsed;
                updateData.block_number = blockNumber;
                updateData2.transaction_hash = txHash;
            }

            for (const playId of playIds) {
                await this.db
                    .update(rewards)
                    .set(updateData)
                    .where(eq(rewards.play_id, playId));

                await this.db
                    .update(music_plays)
                    .set(updateData2)
                    .where(eq(music_plays.id, playId));
            }

            console.log(`리워드 배치 상태 업데이트 완료료: ${playIds.length}개 기록, Status: ${status}`);
        } catch (error) {
            console.error('리워드 배치 상태 업데이트 실패:', error);
            throw error;
        }
    }

    // 회사 및 음원의 총 누적 리워드 금액 업데이트
    async updateCompanyAndMusicTotalRewards(pendingRewards) {
        console.log('=== 회사 및 음원 누적 리워드 업데이트 시작 ===');

        if (!pendingRewards || pendingRewards.length === 0) {
            console.log('업데이트할 리워드 데이터가 없습니다.');
            return;
        }

        try {
            // 1. 회사별 리워드 총합 계산
            const companyRewards = new Map<number, number>();

            // 2. 음원별 리워드 총합 계산
            const musicRewards = new Map<number, number>();

            // pendingRewards 배열을 순회하여 집계
            for (const reward of pendingRewards) {
                const companyId = reward.companyId;
                const musicId = reward.musicId;
                const amount = parseFloat(reward.amount) || 0;

                // 회사별 집계
                if (companyRewards.has(companyId)) {
                    companyRewards.set(companyId, companyRewards.get(companyId)! + amount);
                } else {
                    companyRewards.set(companyId, amount);
                }

                // 음원별 집계
                if (musicRewards.has(musicId)) {
                    musicRewards.set(musicId, musicRewards.get(musicId)! + amount);
                } else {
                    musicRewards.set(musicId, amount);
                }
            }

            console.log(`집계 완료: 회사 ${companyRewards.size}개, 음원 ${musicRewards.size}개`);

            // 3. 회사별 누적 리워드 업데이트
            for (const [companyId, totalAmount] of companyRewards) {
                if (totalAmount > 0) {
                    try {
                        await this.db
                            .update(companies)
                            .set({
                                total_rewards_earned: sql`${companies.total_rewards_earned} + ${totalAmount}`,
                                updated_at: new Date()
                            })
                            .where(eq(companies.id, companyId));

                        console.log(`회사 ${companyId}: ${totalAmount} 토큰 누적 완료`);
                    } catch (error) {
                        console.error(`회사 ${companyId} 누적 리워드 업데이트 실패:`, error);
                    }
                }
            }

            // 4. 음원별 누적 리워드 업데이트
            for (const [musicId, totalAmount] of musicRewards) {
                if (totalAmount > 0) {
                    try {
                        await this.db
                            .update(musics)
                            .set({
                                total_rewarded_amount: sql`${musics.total_rewarded_amount} + ${totalAmount}`,
                                updated_at: new Date()
                            })
                            .where(eq(musics.id, musicId));

                        console.log(`음원 ${musicId}: ${totalAmount} 토큰 누적 완료`);
                    } catch (error) {
                        console.error(`음원 ${musicId} 누적 리워드 업데이트 실패:`, error);
                    }
                }
            }

            console.log('=== 회사 및 음원 누적 리워드 업데이트 완료 ===');

        } catch (error) {
            console.error('회사 및 음원 누적 리워드 업데이트 중 오류:', error);
            throw error;
        }
    }



    // 특정 회사의 pending 리워드 조회
    async getCompanyPendingRewards(companyId: number, targetDate?: Date) {
        const date = targetDate || new Date();

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // 기업의 총 누적 리워드 금액 업데이트
        // await this.db
        //     .update(companies)
        //     .set({})

        const result = await this.db
            .select({
                playId: rewards.play_id,
                companyId: rewards.company_id,
                musicId: rewards.music_id,
                rewardCode: rewards.reward_code,
                amount: rewards.amount,
                usedAt: rewards.created_at
            })
            .from(rewards)
            .where(
                and(
                    eq(rewards.company_id, companyId),
                    gte(rewards.created_at, startOfDay),
                    lt(rewards.created_at, endOfDay),
                    eq(rewards.reward_code, "1"), // reward_code가 1인 경우만
                    eq(rewards.status, 'pending'),
                    // isNotNull(rewards.payout_tx_hash)
                )
            )
            .orderBy(desc(rewards.created_at));

        return result;
    }

    // 테스트용 더미 데이터 생성 (개발 환경 전용)
    async createTestData(recordCount: number = 100, targetDate?: Date) {
        const date = targetDate || (() => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday;
        })();

        console.log(`테스트 데이터 생성 시작: ${recordCount}건, 날짜: ${date.toDateString()}`);

        const testData: typeof rewards.$inferInsert[] = [];

        // 랜덤 데이터 생성 범위
        const companyIds = [1, 2, 3]; // 회사 ID 범위
        const musicIds = Array.from({ length: 5 }, (_, i) => i + 1); // 음원 ID 1-50
        const rewardCodes = ['0', '1', '2', '3']; // 리워드 코드
        const rewardCodeWeights = [0.3, 0.4, 0.2, 0.1]; // 0: 30%, 1: 40%, 2: 20%, 3: 10%

        // 날짜 범위 설정 (해당 날짜 하루 동안)
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        for (let i = 0; i < recordCount; i++) {
            // 랜덤 시간 생성 (해당 날짜 범위 내)
            const randomTime = new Date(
                startOfDay.getTime() +
                Math.random() * (endOfDay.getTime() - startOfDay.getTime())
            );

            // 가중치를 고려한 랜덤 리워드 코드 선택
            const randomValue = Math.random();
            let rewardCode = '0';
            let cumulativeWeight = 0;

            for (let j = 0; j < rewardCodes.length; j++) {
                cumulativeWeight += rewardCodeWeights[j];
                if (randomValue <= cumulativeWeight) {
                    rewardCode = rewardCodes[j];
                    break;
                }
            }

            // 리워드 금액 계산 (reward_code가 1인 경우에만 금액 설정)
            let amount = '0';
            if (rewardCode === '1') {
                // 1~10 토큰 사이의 랜덤 금액 (소수점 2자리까지)
                amount = (Math.random() * 9 + 1).toFixed(2);
            }

            const record = {
                company_id: companyIds[Math.floor(Math.random() * companyIds.length)],
                music_id: musicIds[Math.floor(Math.random() * musicIds.length)],
                play_id: 1000000 + i, // 고유한 play_id 생성
                reward_code: rewardCode as '0' | '1' | '2' | '3',
                amount: amount,
                status: 'pending' as const,
                created_at: randomTime,
                updated_at: randomTime
            };

            testData.push(record);
        }

        try {
            // 배치로 데이터 삽입
            const result = await this.db
                .insert(rewards)
                .values(testData)
                .returning({
                    id: rewards.id,
                    company_id: rewards.company_id,
                    music_id: rewards.music_id,
                    play_id: rewards.play_id,
                    reward_code: rewards.reward_code,
                    amount: rewards.amount,
                    created_at: rewards.created_at
                });

            console.log(`테스트 데이터 생성 완료: ${result.length}건 삽입됨`);

            // 생성된 데이터 통계
            const stats = {
                totalRecords: result.length,
                byRewardCode: {} as Record<string, number>,
                byCompany: {} as Record<number, number>,
                totalRewardAmount: 0,
                date: date.toDateString()
            };

            result.forEach(record => {
                // 리워드 코드별 통계
                stats.byRewardCode[record.reward_code] = (stats.byRewardCode[record.reward_code] || 0) + 1;

                // 회사별 통계
                stats.byCompany[record.company_id] = (stats.byCompany[record.company_id] || 0) + 1;

                // 총 리워드 금액 (reward_code가 1인 경우만)
                if (record.reward_code === '1') {
                    stats.totalRewardAmount += parseFloat(record.amount);
                }
            });

            return {
                success: true,
                stats,
                message: `${recordCount}건의 테스트 데이터가 성공적으로 생성되었습니다.`
            };

        } catch (error) {
            console.error('테스트 데이터 생성 실패:', error);
            throw new HttpException(
                `테스트 데이터 생성 중 오류 발생: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    // 테스트 데이터 삭제 (특정 날짜)
    async deleteTestData(targetDate?: Date) {
        const date = targetDate || (() => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return yesterday;
        })();

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        try {
            const deleteResult = await this.db
                .delete(rewards)
                .where(
                    and(
                        gte(rewards.created_at, startOfDay),
                        lt(rewards.created_at, endOfDay),
                        eq(rewards.status, 'pending') // pending 상태만 삭제
                    )
                )
                .returning({ id: rewards.id });

            console.log(`테스트 데이터 삭제 완료: ${deleteResult.length}건 삭제됨`);

            return {
                success: true,
                deletedCount: deleteResult.length,
                date: date.toDateString(),
                message: `${date.toDateString()} 날짜의 pending 상태 데이터 ${deleteResult.length}건이 삭제되었습니다.`
            };

        } catch (error) {
            console.error('테스트 데이터 삭제 실패:', error);
            throw new HttpException(
                `테스트 데이터 삭제 중 오류 발생: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}