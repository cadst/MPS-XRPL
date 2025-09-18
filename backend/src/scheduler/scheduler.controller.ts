import { Controller, Post, Query, HttpException, HttpStatus } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
    constructor(private readonly schedulerService: SchedulerService) { }

    // 수동으로 스케줄러 실행 (테스트용) - 배치 처리
    @Post('run-manual')
    async runManual(@Query('date') dateString?: string) {
        try {
            let targetDate: Date | undefined;

            if (dateString) {
                targetDate = new Date(dateString);
                if (isNaN(targetDate.getTime())) {
                    throw new HttpException('유효하지 않은 날짜 형식입니다. (YYYY-MM-DD)', HttpStatus.BAD_REQUEST);
                }
            }

            const result = await this.schedulerService.manualExecute(targetDate);

            return {
                success: result.success,
                message: result.success ? '배치 처리 완료' : '배치 처리 실패',
                data: {
                    totalRecords: result.total,
                    txHash: result.txHash,
                    error: result.error
                }
            };

        } catch (error) {
            throw new HttpException(
                `수동 실행 실패: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}
