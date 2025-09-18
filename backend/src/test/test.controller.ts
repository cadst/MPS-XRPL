import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { SchedulerService } from '../scheduler/scheduler.service';
import { RecordService } from '../record/record.service';

@Controller('test')
export class TestController {
    constructor(
        private readonly schedulerService: SchedulerService,
        private readonly recordService: RecordService,
    ) { }

    // 수동 배치 실행 테스트
    @Post('manual-batch')
    async testManualBatch(@Body() body: { targetDate?: string }) {
        const targetDate = body.targetDate ? new Date(body.targetDate) : undefined;
        // console.log(targetDate, "targetDate 입니다.ㅣ")
        return await this.schedulerService.manualExecute(targetDate);
    }

    // 수동 리워드 처리 테스트
    // @Post('manual-reward')
    // async testManualReward(@Body() body: { targetDate?: string }) {
    //     const targetDate = body.targetDate ? new Date(body.targetDate) : undefined;
    //     return await this.schedulerService.manualRewardExecute(targetDate);
    // }

    // 일일 사용량 조회 (pending)
    @Get('daily-usage')
    async getDailyUsage(@Query('status') status?: 'pending' | 'successed' | 'falied', @Query('date') date?: string) {
        const targetDate = date ? new Date(date) : undefined;

        if (status) {
            return await this.recordService.getDailyUsageByStatus(status, targetDate);
        } else {
            return await this.recordService.getDailyUsage();
        }
    }

    // 일일 리워드 집계 조회
    @Get('reward-aggregation')
    async getRewardAggregation(@Query('date') date?: string) {
        const targetDate = date ? new Date(date) : undefined;
        return await this.recordService.getDailyRewardAggregation(targetDate);
    }

    // 회사별 pending 리워드 조회
    @Get('company-rewards')
    async getCompanyRewards(@Query('companyId') companyId: string, @Query('date') date?: string) {
        const targetDate = date ? new Date(date) : undefined;
        return await this.recordService.getCompanyPendingRewards(parseInt(companyId), targetDate);
    }

    // 시스템 상태 확인
    @Get('system-status')
    async getSystemStatus() {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const [
            todayPending,
            todaySuccessed,
            yesterdayPending,
            yesterdaySuccessed,
            rewardAggregation
        ] = await Promise.all([
            this.recordService.getDailyUsageByStatus('pending', today),
            this.recordService.getDailyUsageByStatus('successed', today),
            this.recordService.getDailyUsageByStatus('pending', yesterday),
            this.recordService.getDailyUsageByStatus('successed', yesterday),
            this.recordService.getDailyRewardAggregation(yesterday)
        ]);

        return {
            today: {
                pending: todayPending.length,
                successed: todaySuccessed.length,
                date: today.toDateString()
            },
            yesterday: {
                pending: yesterdayPending.length,
                successed: yesterdaySuccessed.length,
                date: yesterday.toDateString()
            },
            rewardAggregation: {
                companies: rewardAggregation.length,
                totalAmount: rewardAggregation.reduce((sum, item) => sum + item.totalRewardAmount, 0),
                data: rewardAggregation
            }
        };
    }

    // 테스트 데이터 생성 (개발 환경용)
    @Post('create-test-data')
    async createTestData(@Body() body: { recordCount?: number; targetDate?: string }) {
        const recordCount = body.recordCount || 100;
        const targetDate = body.targetDate ? new Date(body.targetDate) : undefined;

        return await this.recordService.createTestData(recordCount, targetDate);
    }

    // 테스트 데이터 삭제 (개발 환경용)
    @Post('delete-test-data')
    async deleteTestData(@Body() body: { targetDate?: string }) {
        const targetDate = body.targetDate ? new Date(body.targetDate) : undefined;

        return await this.recordService.deleteTestData(targetDate);
    }
}
