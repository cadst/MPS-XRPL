import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecordService } from '../record/record.service';
import { ethers } from 'ethers';

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private recordUsageContract: ethers.Contract;
    private rewardTokenContract: ethers.Contract;

    constructor(private readonly recordService: RecordService) {
        // 환경변수 확인
        this.logger.log('=== 환경변수 확인 ===');
        this.logger.log(`INFURA_RPC: ${process.env.INFURA_RPC ? '설정됨' : '설정되지 않음'}`);
        this.logger.log(`PRIVATE_KEY: ${process.env.PRIVATE_KEY ? '설정됨' : '설정되지 않음'}`);
        this.logger.log(`RECORD_USAGE_CONTRACT_ADDRESS: ${process.env.RECORD_USAGE_CONTRACT_ADDRESS ? '설정됨' : '설정되지 않음'}`);
        this.logger.log(`REWARD_TOKEN_CONTRACT_ADDRESS: ${process.env.REWARD_TOKEN_CONTRACT_ADDRESS ? '설정됨' : '설정되지 않음'}`);

        // 필수 환경변수 검증
        if (!process.env.INFURA_RPC) {
            throw new Error('INFURA_RPC 환경변수가 설정되지 않았습니다.');
        }
        if (!process.env.PRIVATE_KEY) {
            throw new Error('PRIVATE_KEY 환경변수가 설정되지 않았습니다.');
        }
        if (!process.env.RECORD_USAGE_CONTRACT_ADDRESS) {
            throw new Error('RECORD_USAGE_CONTRACT_ADDRESS 환경변수가 설정되지 않았습니다.');
        }
        if (!process.env.REWARD_TOKEN_CONTRACT_ADDRESS) {
            throw new Error('REWARD_TOKEN_CONTRACT_ADDRESS 환경변수가 설정되지 않았습니다.');
        }

        // 블록체인 설정 초기화
        this.provider = new ethers.JsonRpcProvider(process.env.INFURA_RPC);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);

        // RecordUsage 컨트랙트 설정 - 배치 처리용
        const recordUsageAbi = [
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "initial_owner",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "_rewardToken",
                        "type": "address"
                    }
                ],
                "stateMutability": "nonpayable",
                "type": "constructor"
            },
            {
                "inputs": [],
                "name": "EmptyBatch",
                "type": "error"
            },
            {
                "inputs": [],
                "name": "EnforcedPause",
                "type": "error"
            },
            {
                "inputs": [],
                "name": "ExpectedPause",
                "type": "error"
            },
            {
                "inputs": [],
                "name": "InvalidTrackId",
                "type": "error"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "owner",
                        "type": "address"
                    }
                ],
                "name": "OwnableInvalidOwner",
                "type": "error"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "account",
                        "type": "address"
                    }
                ],
                "name": "OwnableUnauthorizedAccount",
                "type": "error"
            },
            {
                "inputs": [],
                "name": "ReentrancyGuardReentrantCall",
                "type": "error"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": true,
                        "internalType": "address",
                        "name": "processor",
                        "type": "address"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "recordCount",
                        "type": "uint256"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "timestamp",
                        "type": "uint256"
                    }
                ],
                "name": "BatchRecorded",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "totalRecipients",
                        "type": "uint256"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "totalAmount",
                        "type": "uint256"
                    }
                ],
                "name": "DailyRewardsBatchProcessed",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": true,
                        "internalType": "address",
                        "name": "previousOwner",
                        "type": "address"
                    },
                    {
                        "indexed": true,
                        "internalType": "address",
                        "name": "newOwner",
                        "type": "address"
                    }
                ],
                "name": "OwnershipTransferred",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "account",
                        "type": "address"
                    }
                ],
                "name": "Paused",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": true,
                        "internalType": "uint256",
                        "name": "company_id",
                        "type": "uint256"
                    },
                    {
                        "indexed": true,
                        "internalType": "uint256",
                        "name": "track_id",
                        "type": "uint256"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "play_id",
                        "type": "uint256"
                    },
                    {
                        "indexed": false,
                        "internalType": "enum RecordUsage.RewardCode",
                        "name": "reward_code",
                        "type": "uint8"
                    },
                    {
                        "indexed": false,
                        "internalType": "uint256",
                        "name": "usedAt",
                        "type": "uint256"
                    }
                ],
                "name": "PlayRecorded",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {
                        "indexed": false,
                        "internalType": "address",
                        "name": "account",
                        "type": "address"
                    }
                ],
                "name": "Unpaused",
                "type": "event"
            },
            {
                "inputs": [],
                "name": "owner",
                "outputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "pause",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "paused",
                "outputs": [
                    {
                        "internalType": "bool",
                        "name": "",
                        "type": "bool"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address[]",
                        "name": "recipients",
                        "type": "address[]"
                    },
                    {
                        "internalType": "uint256[]",
                        "name": "amounts",
                        "type": "uint256[]"
                    }
                ],
                "name": "processDailyRewardsBatch",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "components": [
                            {
                                "internalType": "uint256",
                                "name": "company_id",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "music_id",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint256",
                                "name": "play_id",
                                "type": "uint256"
                            },
                            {
                                "internalType": "uint8",
                                "name": "reward_code",
                                "type": "uint8"
                            },
                            {
                                "internalType": "uint256",
                                "name": "created_at",
                                "type": "uint256"
                            }
                        ],
                        "internalType": "struct RecordUsage.UsageRecord[]",
                        "name": "usageRecords",
                        "type": "tuple[]"
                    }
                ],
                "name": "recordDailyUsageBatch",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "renounceOwnership",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "rewardToken",
                "outputs": [
                    {
                        "internalType": "contract IRewardToken",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "newOwner",
                        "type": "address"
                    }
                ],
                "name": "transferOwnership",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "unpause",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ];

        this.recordUsageContract = new ethers.Contract(
            process.env.RECORD_USAGE_CONTRACT_ADDRESS!,
            recordUsageAbi,
            this.wallet
        );

        // RewardToken2 컨트랙트 설정
        const rewardTokenAbi = []

        this.rewardTokenContract = new ethers.Contract(
            process.env.REWARD_TOKEN_CONTRACT_ADDRESS!,
            rewardTokenAbi,
            this.wallet
        );

        this.logger.log('스케줄러 서비스가 초기화되었습니다.');
    }

    // 매일 오전 9시 50분에 실행
    @Cron('9 50 0 * * *', {
        name: 'dailyBlockchainRecord',
        timeZone: 'Asia/Seoul'
    })
    async handleDailyBlockchainRecord() {
        this.logger.log('=== 일일 블록체인 기록 스케줄러 시작 ===');

        try {
            // 전날 날짜 계산
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            this.logger.log(`처리 대상 날짜: ${yesterday.toDateString()}`);

            // 전날의 pending 상태 데이터 조회
            const dailyUsage = await this.recordService.getDailyUsageByStatus('pending', yesterday);

            if (dailyUsage.length === 0) {
                this.logger.log('처리할 데이터가 없습니다.');
                return;
            }

            this.logger.log(`처리할 레코드 수: ${dailyUsage.length}`);

            try {
                // 배치 처리로 블록체인에 기록
                const { txHash, gasUsed, blockNumber } = await this.sendBatchToBlockchain(dailyUsage);

                // 모든 레코드의 상태를 업데이트
                await this.updateAllRecordsStatus(dailyUsage, txHash, 'pending', gasUsed, blockNumber);

                this.logger.log(`배치 처리 성공 - 총 ${dailyUsage.length}개 레코드, TX: ${txHash}`);

                // 리워드 토큰 배치 처리 실행
                await this.processRewardTokenBatch(yesterday);

            } catch (error) {
                this.logger.error('배치 처리 실패:', error.message);

                // 모든 레코드의 상태를 실패로 업데이트
                await this.updateAllRecordsStatus(dailyUsage, null, 'falied', 0, 0);
            }

            this.logger.log('=== 일일 블록체인 기록 스케줄러 완료 ===');

        } catch (error) {
            this.logger.error('일일 블록체인 기록 스케줄러 실행 중 오류:', error);
        }
    }

    // 리워드 토큰 배치 처리
    private async processRewardTokenBatch(targetDate: Date) {
        this.logger.log('=== 리워드 토큰 배치 처리 시작 ===');

        try {
            // 일일 리워드 집계 조회 (reward_code=1, pending 상태)
            const rewardAggregation = await this.recordService.getDailyRewardAggregation(targetDate);
            console.log(rewardAggregation, "rewardAggregation 결과")

            if (rewardAggregation.length === 0) {
                this.logger.log('처리할 리워드가 없습니다.21384');
                return;
            }

            this.logger.log(`리워드 지급 대상: ${rewardAggregation.length}개 회사`);

            // 배치 데이터 준비
            const recipients: string[] = [];
            const amounts: string[] = [];
            const companyIds: number[] = [];

            for (const reward of rewardAggregation) {
                if (reward.smartAccountAddress && reward.totalRewardAmount > 0) {
                    recipients.push(reward.smartAccountAddress);
                    amounts.push(ethers.parseEther(reward.totalRewardAmount.toString()).toString());
                    companyIds.push(reward.companyId);
                }
            }

            if (recipients.length === 0) {
                this.logger.log('유효한 리워드 지급 대상이 없습니다.');
                return;
            }

            this.logger.log(`실제 지급 대상: ${recipients.length}개 주소`);

            // 리워드 토큰 배치 지급 실행
            const { rewardTxHash, gasUsed, blockNumber } = await this.sendRewardTokenBatch(recipients, amounts);

            // 해당 날짜의 모든 reward_code=1 레코드들의 상태 업데이트
            await this.updateRewardRecordsStatus(companyIds, targetDate, rewardTxHash, 'successed', gasUsed, blockNumber);

            // await this.recordService.updateCompanyAndMusicTotalRewards(rewardAggregation);

            this.logger.log(`리워드 토큰 배치 지급 완료 - TX: ${rewardTxHash}`);

        } catch (error) {
            this.logger.error('리워드 토큰 배치 처리 실패:', error.message);
            // 실패 시 상태 업데이트는 하지 않음 (다음 날 재시도 가능하도록)
        }

        this.logger.log('=== 리워드 토큰 배치 처리 완료 ===');
    }

    // 리워드 토큰 배치 전송
    private async sendRewardTokenBatch(recipients: string[], amounts: string[]): Promise<{ rewardTxHash: string, gasUsed: ethers.BigNumberish, blockNumber: number }> {
        try {
            this.logger.log('리워드 토큰 배치 전송 중...');

            // 가스 추정
            const baseGas = 150000;
            const gasPerRecipient = 80000;
            const estimatedGas = baseGas + (gasPerRecipient * recipients.length);

            this.logger.log(`예상 가스 사용량: ${estimatedGas}`);

            // RecordUsage 컨트랙트를 통해 리워드 배치 처리
            const tx = await this.recordUsageContract.processDailyRewardsBatch(
                recipients,
                amounts,
                {
                    gasLimit: estimatedGas,
                    maxFeePerGas: ethers.parseUnits('25', 'gwei'),
                    maxPriorityFeePerGas: ethers.parseUnits('3', 'gwei')
                }
            );

            this.logger.log(`리워드 배치 트랜잭션 전송됨: ${tx.hash}`);

            // 트랜잭션 확인 대기
            const receipt = await tx.wait();

            if (receipt.status === 1) {
                this.logger.log(`리워드 배치 트랜잭션 성공: ${tx.hash}, 가스 사용량: ${receipt.gasUsed}, 블록 번호: ${receipt.blockNumber}`);

                // await this.updateCompanyAndMusicRewards(recipients, amounts);

                return { rewardTxHash: tx.hash, gasUsed: receipt.gasUsed, blockNumber: receipt.blockNumber };
            } else {
                throw new Error(`리워드 배치 트랜잭션 실패: ${tx.hash}`);
            }

        } catch (error) {
            this.logger.error('리워드 토큰 배치 전송 실패:', error);
            throw error;
        }
    }

    // 회사 및 음악별 리워드 합계 업데이트
    // private async updateCompanyAndMusicRewards(recipients: string[], amounts: string[]) {
    //     this.logger.log('회사 및 음악별 리워드 합계 업데이트 중...');
    //     for (let i = 0; i < recipients.length; i++) {
    //         const recipient = recipients[i];
    //         const amount = parseFloat(ethers.formatEther(amounts[i]));
    //         try {
    //     }
    // }

    // 리워드 레코드들의 상태 업데이트
    private async updateRewardRecordsStatus(companyIds: number[], targetDate: Date, txHash: string, status: 'successed' | 'falied', gasUsed: ethers.BigNumberish, blockNumber: number) {
        this.logger.log(`리워드 레코드 상태 업데이트 중...`);

        for (const companyId of companyIds) {
            try {
                const pendingRewards = await this.recordService.getCompanyPendingRewards(companyId, targetDate);
                console.log(pendingRewards, "pendingRewards 입니다.람")

                // 회사 및 음악별 총 리워드 합계 업데이트
                await this.recordService.updateCompanyAndMusicTotalRewards(pendingRewards);

                const playIds = pendingRewards.map(reward => reward.playId);
                console.log(playIds, "playIds 입니ㅑ댜")

                if (playIds.length > 0) {
                    await this.recordService.updateRewardBatchStatus(playIds, txHash, status, gasUsed, blockNumber);
                    this.logger.log(`회사 ${companyId}: ${playIds.length}개 리워드 레코드 상태 업데이트 완료`);
                }
            } catch (error) {
                this.logger.error(`회사 ${companyId} 리워드 상태 업데이트 실패:`, error);
            }
        }

        this.logger.log('모든 리워드 레코드 상태 업데이트 완료');
    }

    // 배치로 레코드들을 블록체인에 전송
    private async sendBatchToBlockchain(records: any[]): Promise<{ txHash: string, gasUsed: ethers.BigNumberish, blockNumber: number }> {
        try {
            this.logger.log('배치 데이터 준비 중...');

            console.log(records, "컨트랙트 형식으로 변환하기 전 집계한 하루치 유효재생")
            // 레코드들을 컨트랙트 형식에 맞게 변환
            const usageRecords = records.map(record => ({
                company_id: record.companyId,
                music_id: record.musicId,
                play_id: record.playId,
                reward_code: this.convertRewardCode(record.rewardCode),
                created_at: Math.floor(new Date(record.usedAt).getTime() / 1000)
            }));

            this.logger.log(`배치 데이터 구성 완료: ${usageRecords.length}개 레코드`);

            // 가스 추정 (레코드 수에 따라 동적 조정)
            const baseGas = 100000; // 기본 가스
            const gasPerRecord = 50000; // 레코드당 추가 가스
            const estimatedGas = baseGas + (gasPerRecord * records.length);

            this.logger.log(`예상 가스 사용량: ${estimatedGas}`);

            // 배치 컨트랙트 함수 호출
            const tx = await this.recordUsageContract.recordDailyUsageBatch(
                usageRecords,
                {
                    gasLimit: estimatedGas,
                    maxFeePerGas: ethers.parseUnits('20', 'gwei'),
                    maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
                }
            );

            this.logger.log(`배치 트랜잭션 전송됨: ${tx.hash}`);

            // 트랜잭션 확인 대기
            const receipt = await tx.wait();

            if (receipt.status === 1) {
                this.logger.log(`배치 트랜잭션 성공: ${tx.hash}, 가스 사용량: ${receipt.gasUsed}`);
                return { txHash: tx.hash, gasUsed: receipt.gasUsed, blockNumber: receipt.blockNumber };
            } else {
                throw new Error(`배치 트랜잭션 실패: ${tx.hash}`);
            }

        } catch (error) {
            this.logger.error('배치 블록체인 전송 실패:', error);
            throw error;
        }
    }

    // 모든 레코드의 상태를 일괄 업데이트
    private async updateAllRecordsStatus(records: any[], txHash: string | null, status: 'successed' | 'falied' | 'pending', gasUsed?: ethers.BigNumberish, blockNumber?: number) {
        this.logger.log(`${records.length}개 레코드의 상태를 ${status}로 업데이트 중...`);

        for (const record of records) {
            try {
                await this.recordService.updateRewardStatus(record.playId, txHash, status, gasUsed, blockNumber);
            } catch (error) {
                this.logger.error(`Play ID ${record.playId} 상태 업데이트 실패:`, error);
            }
        }

        this.logger.log('모든 레코드 상태 업데이트 완료');
    }

    // reward_code 문자열을 숫자로 변환
    private convertRewardCode(rewardCode: string): number {
        const codeMap: { [key: string]: number } = {
            '0': 0, // Rewardless
            '1': 1, // Rewarded  
            '2': 2, // MusicLimit
            '3': 3  // CompanyLimit
        };

        return codeMap[rewardCode] ?? 0;
    }



    // 수동 실행 메서드 (테스트용) - 배치 처리 버전: 당일 날짜
    async manualExecute(targetDate?: Date): Promise<{ success: boolean; total: number; txHash?: string; rewardTxHash?: string; error?: string }> {
        this.logger.log('=== 수동 블록체인 기록 실행 (배치 처리) ===');

        const processDate = targetDate || (() => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate());
            console.log(yesterday, "today 날짜입니다.")
            return yesterday;
        })();

        this.logger.log(`처리 대상 날짜: ${processDate.toDateString()}`);

        const dailyUsage = await this.recordService.getDailyUsageByStatus('pending', processDate);

        if (dailyUsage.length === 0) {
            this.logger.log('처리할 데이터가 없습니다.');
            return { success: true, total: 0 };
        }

        try {
            // 1. 사용 내역 배치 처리
            const { txHash, gasUsed, blockNumber } = await this.sendBatchToBlockchain(dailyUsage);

            await this.updateAllRecordsStatus(dailyUsage, txHash, 'pending', gasUsed, blockNumber);

            this.logger.log(`수동 배치 실행 완료 - 총 ${dailyUsage.length}개 레코드 성공`);

            // 2. 리워드 토큰 배치 처리
            let rewardTxHash: string | undefined;
            try {
                console.log("여기까지 오나요?ㄴ")
                await this.processRewardTokenBatch(processDate);
                // 리워드 집계에서 실제 트랜잭션 해시를 가져오기 위해 별도 처리 필요
                // const rewardAggregation = await this.recordService.getDailyRewardAggregation(processDate);
                // if (rewardAggregation.length > 0) {
                //     const recipients = rewardAggregation
                //         .filter(r => r.smartAccountAddress && r.totalRewardAmount > 0)
                //         .map(r => r.smartAccountAddress!);
                //     const amounts = rewardAggregation
                //         .filter(r => r.smartAccountAddress && r.totalRewardAmount > 0)
                //         .map(r => ethers.parseEther(r.totalRewardAmount.toString()).toString());

                //     if (recipients.length > 0) {
                //         rewardTxHash = await this.sendRewardTokenBatch(recipients, amounts);
                //     }
                // }
            } catch (rewardError) {
                this.logger.warn('리워드 처리 실패 (사용 내역 기록은 성공):', rewardError.message);
            }

            return { success: true, total: dailyUsage.length, txHash, rewardTxHash };

        } catch (error) {
            this.logger.error('수동 배치 실행 실패:', error.message);
            await this.updateAllRecordsStatus(dailyUsage, null, 'falied', 0, 0);

            return { success: false, total: dailyUsage.length, error: error.message };
        }
    }

    // 수동 리워드 처리 메서드 (별도 실행용)
    // async manualRewardExecute(targetDate?: Date): Promise<{ success: boolean; recipients: number; txHash?: string; error?: string }> {
    //     this.logger.log('=== 수동 리워드 토큰 처리 실행 ===');

    //     const processDate = targetDate || (() => {
    //         const yesterday = new Date();
    //         yesterday.setDate(yesterday.getDate() - 1);
    //         return yesterday;
    //     })();

    //     try {
    //         const rewardAggregation = await this.recordService.getDailyRewardAggregation(processDate);

    //         if (rewardAggregation.length === 0) {
    //             this.logger.log('처리할 리워드가 없습니다.');
    //             return { success: true, recipients: 0 };
    //         }

    //         const recipients = rewardAggregation
    //             .filter(r => r.smartAccountAddress && r.totalRewardAmount > 0)
    //             .map(r => r.smartAccountAddress!);
    //         const amounts = rewardAggregation
    //             .filter(r => r.smartAccountAddress && r.totalRewardAmount > 0)
    //             .map(r => ethers.parseEther(r.totalRewardAmount.toString()).toString());

    //         if (recipients.length === 0) {
    //             this.logger.log('유효한 리워드 지급 대상이 없습니다.');
    //             return { success: true, recipients: 0 };
    //         }

    //         const txHash = await this.sendRewardTokenBatch(recipients, amounts);

    //         // 상태 업데이트
    //         const companyIds = rewardAggregation.map(r => r.companyId);
    //         await this.updateRewardRecordsStatus(companyIds, processDate, txHash, 'successed');

    //         this.logger.log(`수동 리워드 처리 완료 - ${recipients.length}개 주소, TX: ${txHash}`);
    //         return { success: true, recipients: recipients.length, txHash };

    //     } catch (error) {
    //         this.logger.error('수동 리워드 처리 실패:', error.message);
    //         return { success: false, recipients: 0, error: error.message };
    //     }
    // }
}
