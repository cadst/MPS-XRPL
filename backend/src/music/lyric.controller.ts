import {
    Controller,
    Get,
    Param,
    Headers,
    HttpException,
    HttpStatus,
    Res,
    StreamableFile,
    ParseIntPipe
} from '@nestjs/common';
import type { Response } from 'express';
import { MusicService } from './music.service';
import { createReadStream, statSync } from 'fs';
import { join } from 'path';

@Controller('lyric')
export class LyricController {
    constructor(
        private readonly musicService: MusicService,
    ) { }

    @Get(':music_id/download')
    async downloadLyric(
        @Param('music_id', ParseIntPipe) musicId: number,
        @Headers('x-api-key') apiKey: string,
        @Headers('user-agent') userAgent: string,
        @Res({ passthrough: true }) response: Response,
    ) {
        try {
            // 1. API 키 검증
            const company = await this.musicService.validateApiKey(apiKey);
            if (!company) {
                throw new HttpException('유효하지 않은 API 키입니다.', HttpStatus.UNAUTHORIZED);
            }

            // 2. 음원 정보 조회
            const music = await this.musicService.findById(musicId);
            if (!music) {
                throw new HttpException('음원을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
            }

            // 3. 가사 파일 존재 확인
            if (!music.lyrics_file_path) {
                throw new HttpException('가사 파일이 없습니다.', HttpStatus.NOT_FOUND);
            }

            // 4. 회사 등급별 다운로드 권한 확인
            const canDownload = await this.musicService.checkLyricPermission(company, music);
            if (!canDownload) {
                throw new HttpException('가사 다운로드 권한이 없습니다.', HttpStatus.FORBIDDEN);
            }

            // 5. 가사 파일 경로 확인
            const lyricPath = join(process.cwd(), './uploads/lyrics/', music.lyrics_file_path);
            console.log('🔍 찾고 있는 가사 파일 경로:', lyricPath);
            console.log('📝 가사 정보:', { id: music.id, lyrics_file_path: music.lyrics_file_path, title: music.title });

            try {
                const stats = statSync(lyricPath);
                console.log('📊 가사 파일 통계:', { size: stats.size, isFile: stats.isFile() });

                // 6. 응답 헤더 설정
                response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                response.setHeader('Content-Length', stats.size);

                // 안전한 파일명 생성 (한글 제거 및 URL 인코딩)
                const safeFileName = `lyrics_${musicId}.txt`;
                response.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
                console.log('📁 다운로드 파일명:', safeFileName);

                // 7. 음원 재생과 동일한 비즈니스 로직으로 처리: startPlay -> 즉시 유효재생 처리
                // rewardCode 산출 (side-effect 없음)
                const rewardCode = await this.musicService.getRewardCode(music.id, company.id);

                // reward 금액 조회 (월별 리워드 설정)
                const rewardRow = await this.musicService.findRewardById(music.id);
                const rewardAmount = rewardRow ? rewardRow.reward_per_play : 0;

                // startPlay (useCase '2', usePrice = lyrics_price)
                const playRow = await this.musicService.startPlay({
                    musicId: music.id,
                    companyId: company.id,
                    useCase: '2',
                    rewardCode,
                    rewardAmount: rewardAmount.toString(),
                    usePrice: music.lyrics_price,
                });

                await this.musicService.lyricUseStat(music.id);

                // 즉시 유효재생 처리 (리워드 차감, rewards insert 등)
                await this.musicService.recordValidPlayOnce({
                    musicId: music.id,
                    companyId: company.id,
                    useCase: '2',
                    rewardCode,
                    musicPlayId: playRow.id,
                    rewardAmount,
                });

                // 8. 파일 스트림 반환
                const stream = createReadStream(lyricPath);
                return new StreamableFile(stream);

            } catch (fileError) {
                console.error('❌ 가사 파일 접근 오류:', fileError);
                console.log('🔍 시도한 경로:', lyricPath);
                throw new HttpException('가사 파일을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
            }

        } catch (error) {
            console.error('가사 다운로드 에러:', error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                '가사 다운로드 중 오류가 발생했습니다.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
