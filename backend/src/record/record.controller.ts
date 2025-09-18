import {
    Controller, Get, Param, ParseIntPipe, Headers, Res, HttpException, HttpStatus,
    StreamableFile, Query, Req, Post
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { createReadStream, statSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';
import { ethers } from 'ethers';
import { RecordService } from './record.service';

@Controller('record')
export class RecordController {
    private provider: ethers.JsonRpcProvider;
    private wallet: ethers.Wallet;
    private recordUsageContract: ethers.Contract;

    constructor(private readonly recordService: RecordService) {
        // 환경 변수에서 블록체인 설정 읽기
        this.provider = new ethers.JsonRpcProvider(process.env.INFURA_RPC);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);

        // RecordUsage 컨트랙트 ABI (실제 컨트랙트 ABI로 교체 필요)
        const recordUsageAbi = [
            "function recordDailyUsage(uint256 company_id, uint256 music_id, uint256 play_id, uint8 reward_code, uint256 created_at) external",
            "function approvedCompanies(address) view returns (bool)",
            "event PlayRecorded(address indexed using_company, uint256 indexed track_id, uint8 use_case, uint256 play_id, uint8 reward_code)"
        ];

        this.recordUsageContract = new ethers.Contract(
            process.env.RECORD_USAGE_CONTRACT_ADDRESS!,
            recordUsageAbi,
            this.wallet
        );
    }

    // 오늘의 pending 상태 사용내역 조회
    @Get('daily-usage')
    async getDailyUsage() {
        try {
            const result = await this.recordService.getDailyUsage();
            return {
                success: true,
                data: result,
                count: result.length
            };
        } catch (error) {
            throw new HttpException(
                `일일 사용내역 조회 실패: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    // 스마트컨트랙트에 일일 사용내역 기록
    // @Post('record-to-blockchain')
    // async recordToBlockchain() {
    //     try {
    //         console.log('=== 블록체인 기록 시작 ===');

    //         // 1. pending 상태의 일일 사용내역 조회
    //         const dailyUsage = await this.recordService.getDailyUsage();

    //         if (dailyUsage.length === 0) {
    //             return {
    //                 success: true,
    //                 message: '기록할 데이터가 없습니다.',
    //                 processedCount: 0
    //             };
    //         }

    //         console.log(`처리할 레코드 수: ${dailyUsage.length}`);

    //         const results = [];
    //         let successCount = 0;
    //         let failCount = 0;

    //         // 2. 각 레코드를 컨트랙트에 전송
    //         for (let i = 0; i < dailyUsage.length; i++) {
    //             const record = dailyUsage[i];

    //             try {
    //                 console.log(`처리 중 (${i + 1}/${dailyUsage.length}): Play ID ${record.playId}`);

    //                 // reward_code를 숫자로 변환
    //                 const rewardCodeNum = this.convertRewardCode(record.rewardCode);

    //                 // created_at을 초 단위 타임스탬프로 변환
    //                 const timestampInSeconds = Math.floor(new Date(record.usedAt).getTime() / 1000);

    //                 // 컨트랙트 함수 호출
    //                 const tx = await this.recordUsageContract.recordDailyUsage(
    //                     record.companyId,
    //                     record.musicId,
    //                     record.playId,
    //                     rewardCodeNum,
    //                     timestampInSeconds,
    //                     {
    //                         gasLimit: 200000,
    //                         maxFeePerGas: ethers.parseUnits('20', 'gwei'),
    //                         maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei')
    //                     }
    //                 );

    //                 console.log(`트랜잭션 전송됨: ${tx.hash}`);

    //                 // 트랜잭션 확인 대기
    //                 const receipt = await tx.wait();

    //                 if (receipt.status === 1) {
    //                     console.log(`트랜잭션 성공: ${tx.hash}`);

    //                     // DB에서 해당 레코드의 상태를 'successed'로 업데이트
    //                     await this.recordService.updateRewardStatus(record.playId, tx.hash, 'successed');

    //                     results.push({
    //                         playId: record.playId,
    //                         status: 'success',
    //                         txHash: tx.hash,
    //                         gasUsed: receipt.gasUsed.toString()
    //                     });
    //                     successCount++;
    //                 } else {
    //                     throw new Error(`트랜잭션 실패: ${tx.hash}`);
    //                 }

    //                 // 트랜잭션 간 간격 (네트워크 부하 방지)
    //                 if (i < dailyUsage.length - 1) {
    //                     await new Promise(resolve => setTimeout(resolve, 2000));
    //                 }

    //             } catch (error) {
    //                 console.error(`Play ID ${record.playId} 처리 실패:`, error);

    //                 // DB에서 해당 레코드의 상태를 'falied'로 업데이트
    //                 await this.recordService.updateRewardStatus(record.playId, '', 'falied');

    //                 results.push({
    //                     playId: record.playId,
    //                     status: 'failed',
    //                     error: error.message
    //                 });
    //                 failCount++;
    //             }
    //         }

    //         console.log('=== 블록체인 기록 완료 ===');
    //         console.log(`성공: ${successCount}, 실패: ${failCount}`);

    //         return {
    //             success: true,
    //             message: '블록체인 기록 처리 완료',
    //             summary: {
    //                 total: dailyUsage.length,
    //                 success: successCount,
    //                 failed: failCount
    //             },
    //             details: results
    //         };

    //     } catch (error) {
    //         console.error('블록체인 기록 중 오류:', error);
    //         throw new HttpException(
    //             `블록체인 기록 실패: ${error.message}`,
    //             HttpStatus.INTERNAL_SERVER_ERROR
    //         );
    //     }
    // }

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

    // 특정 날짜의 사용내역 조회 (테스트용)
    @Get('daily-usage/:date')
    async getDailyUsageByDate(@Param('date') dateString: string) {
        try {
            const targetDate = new Date(dateString);

            if (isNaN(targetDate.getTime())) {
                throw new HttpException('유효하지 않은 날짜 형식입니다.', HttpStatus.BAD_REQUEST);
            }

            const result = await this.recordService.getDailyUsageByStatus('pending', targetDate);

            return {
                success: true,
                date: dateString,
                data: result,
                count: result.length
            };
        } catch (error) {
            throw new HttpException(
                `특정 날짜 사용내역 조회 실패: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}