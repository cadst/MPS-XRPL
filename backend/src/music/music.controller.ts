import {
    Controller, Get, Param, ParseIntPipe, Headers, Res, HttpException, HttpStatus,
    StreamableFile, Query, Req
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { createReadStream, statSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';
import { MusicService } from './music.service';

type PlayToken = {
    v: 1;
    musicId: number;
    companyId: number;
    startedAt: number;   // epoch ms
    // ⬇ stateless 보정/선형 진행 관리용
    t50?: number;        // 50% 도달 시각(ms)
    b50?: number;        // 50% 도달 당시 바이트 위치(end+1)
    maxSent?: number;    // 지금까지 보낸 최대 바이트(end+1)
};

@Controller('music')
export class MusicController {
    constructor(private readonly musicService: MusicService) { }
    private SIGN_KEY = process.env.PLAY_TOKEN_SECRET || 'dev-secret-change-me';

    private DEFAULT_CHUNK = 1024 * 1024;    // 1MB (Range 없을 때 합성)
    private EARLY_CHUNK = 256 * 1024;     // 앞구간 최소 전송
    private FIRST_REQ_OLD_MS = 3000;        // 첫 Range에서 토큰이 오래되면 리셋

    // 소/대용량 정책
    private SMALL_FILE_THRESHOLD = 3 * 1024 * 1024; // 3MB 이하면 저용량 취급
    private MICRO_OVERSHOOT = 1 * 1024;        // 저용량에서 선형상한 초과 허용(최대 1KB)
    private NORMAL_MIN_CHUNK = 64 * 1024;       // 일반 최소 보장
    private MAX_CHUNK_BASE = 1024 * 1024;     // 절대 상한 1MB
    private MIN_SEC_SLICE = 0.5;             // 동적 최소: 0.5초 분량
    private MAX_SEC_SLICE = 2.0;             // 동적 최대: 2.0초 분량

    // --- util: token ---
    private sign(data: string) {
        return crypto.createHmac('sha256', this.SIGN_KEY).update(data).digest('hex');
    }
    private toWire(t: PlayToken) {
        const payload = JSON.stringify(t);
        const sig = this.sign(payload);
        return Buffer.from(payload).toString('base64url') + '.' + sig;
    }
    private fromWire(raw?: string | null): PlayToken | null {
        if (!raw) return null;
        const [b64, sig] = String(raw).split('.');
        if (!b64 || !sig) return null;
        try {
            const json = Buffer.from(b64, 'base64url').toString('utf8');
            if (this.sign(json) !== sig) return null;
            const obj = JSON.parse(json) as PlayToken;
            if (obj?.v !== 1) return null;
            return obj;
        } catch {
            return null;
        }
    }
    private issueToken(musicId: number, companyId: number): string {
        const token: PlayToken = { v: 1, musicId, companyId, startedAt: Date.now() };
        return this.toWire(token);
    }
    private getCookie(req: Request, name: string): string | null {
        const h = req.headers['cookie'];
        if (!h) return null;
        const m = h.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
        return m ? decodeURIComponent(m.split('=')[1]) : null;
    }
    private pickNewestTokenRaw(cands: Array<string | null | undefined>): { raw: string; token: PlayToken } | null {
        const parsed: Array<{ raw: string; token: PlayToken }> = [];
        for (const c of cands) {
            if (!c) continue;
            const t = this.fromWire(c);
            if (t) parsed.push({ raw: c, token: t });
        }
        if (parsed.length === 0) return null;
        parsed.sort((a, b) => b.token.startedAt - a.token.startedAt);
        return parsed[0];
    }

    @Get(':music_id/play')
    async playMusic(
        @Param('music_id', ParseIntPipe) musicId: number,
        @Headers('x-api-key') headerApiKey: string,
        @Headers('range') range: string,
        @Headers('x-play-token') playTokenHeader: string,
        @Query('pt') playTokenQuery: string,
        @Query('api_key') apiKeyQuery: string,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ) {
        try {
            // 1) 인증
            let company: any = null;
            const apiKey = headerApiKey || apiKeyQuery;
            if (apiKey) {
                company = await this.musicService.validateApiKey(apiKey);
            }

            // 2) 토큰 (헤더/쿼리/쿠키 중 가장 최신)
            const picked = this.pickNewestTokenRaw([playTokenHeader, playTokenQuery, this.getCookie(req, 'pt')]);
            let token: PlayToken | null = picked?.token ?? null;
            let tokenStr: string = picked?.raw ?? '';

            if (!company && token) {
                company = await this.musicService.findCompanyById(token.companyId);
            }
            if (!company) throw new HttpException('API 키가 필요합니다.', HttpStatus.UNAUTHORIZED);

            // 3) 음원/권한
            const music = await this.musicService.findById(musicId);
            if (!music) throw new HttpException('음원을 찾을 수 없습니다.', HttpStatus.NOT_FOUND);
            const ok = await this.musicService.checkPlayPermission(company, music);
            if (!ok) throw new HttpException('재생 권한이 없습니다.', HttpStatus.FORBIDDEN);

            // 4) 세션
            const activeSession = await this.musicService.findActiveSession(music.id, company.id);
            let musicPlayId: number;
            let rewardInfo: any;
            let rewardAmount: any;
            if (activeSession) {
                musicPlayId = activeSession.id;
                rewardInfo = activeSession.reward_code;
                rewardAmount = activeSession.reward_amount ?? 0;
            } else {
                rewardInfo = await this.musicService.getRewardCode(musicId, company.id);
                const rewardRow = await this.musicService.findRewardById(musicId);
                rewardAmount = rewardRow ? rewardRow.reward_per_play : 0;
                const startPlay = await this.musicService.startPlay({
                    musicId: music.id,
                    companyId: company.id,
                    useCase: music.inst ? '1' : '0',
                    rewardCode: rewardInfo,
                    rewardAmount: String(rewardAmount),
                    usePrice: music.price_per_play,
                });
                musicPlayId = startPlay.id;
                await this.musicService.updateInitMusicStats(music.id);
            }

            // 5) 파일
            const filePath = join(process.cwd(), '/uploads/music/', music.file_path);
            const fileSize = statSync(filePath).size;

            // 6) 토큰 재발급(불일치 시)
            if (!token || token.musicId !== music.id || token.companyId !== company.id) {
                tokenStr = this.issueToken(music.id, company.id);
                token = this.fromWire(tokenStr)!;
                res.setHeader('X-Play-Token', tokenStr);
                res.setHeader('Set-Cookie', `pt=${encodeURIComponent(tokenStr)}; Path=/; HttpOnly; SameSite=Lax`);
            }

            // 7) Range 없으면 합성(1MB)
            if (!range || !range.startsWith('bytes=')) {
                const syntheticEnd = Math.min(fileSize - 1, this.DEFAULT_CHUNK - 1);
                range = `bytes=0-${syntheticEnd}`;
            }
            this.setNoCacheHeaders(res, tokenStr);
            return await this.handleRangeRequestStateless({
                tokenStr, token: token!, music, companyId: company.id,
                filePath, fileSize, range, res, musicPlayId, rewardInfo, rewardAmount
            });
        } catch (e) {
            this.setNoCacheHeaders(res);
            console.error('음원 재생 에러:', e);
            if (e instanceof HttpException) throw e;
            throw new HttpException('음원 재생 중 오류', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    private setNoCacheHeaders(res: Response, tokenStr?: string) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0, s-maxage=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store'); // CDN/프록시
        res.setHeader('Vary', 'Range, Cookie, X-Play-Token, Authorization');

        // 토큰 기반 약한 ETag로 잘못된 공유캐시 방지
        if (tokenStr) {
            const tag = crypto.createHash('sha1').update(tokenStr).digest('hex');
            res.setHeader('ETag', `W/"pt-${tag}"`);
        }
    }
    // --- Range 처리 + 'pre-50 자유주행, post-50 (halfMs+skew)까지 선형 100%' ---
    private async handleRangeRequestStateless(opts: {
        tokenStr: string;
        token: PlayToken;
        music: any;
        companyId: number;
        filePath: string;
        fileSize: number;
        range: string;
        res: Response;
        musicPlayId: number;
        rewardInfo: any;
        rewardAmount: any;
    }): Promise<StreamableFile> {
        const {
            tokenStr, token, music, companyId, filePath, fileSize, range, res,
            musicPlayId, rewardInfo, rewardAmount
        } = opts;

        // 1) Range 파싱/정규화
        const parts = range.replace('bytes=', '').split('-');
        let start = parseInt(parts[0] || '0', 10);
        let reqEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (!Number.isFinite(start) || start < 0) start = 0;
        if (!Number.isFinite(reqEnd) || reqEnd >= fileSize) reqEnd = fileSize - 1;
        // 역전 보정(start > end로 오는 경우)
        if (reqEnd < start) {
            const seed = this.EARLY_CHUNK || 256 * 1024;
            reqEnd = Math.min(fileSize - 1, start + seed - 1);
        }
        if (start >= fileSize) start = fileSize - 1;

        const HARD_MAX = Math.min(reqEnd, fileSize - 1);
        const clampEnd = (v: number) => Math.min(Math.max(v, start), fileSize - 1);

        // 2) 토큰/세션 초기화 (오래된 토큰 재발급만; startedAt은 '최초 전송'에서만 세팅)
        let t = token;
        let tStr = tokenStr;
        const now = Date.now();
        if (start === 0 && (!t || (now - t.startedAt) > this.FIRST_REQ_OLD_MS)) {
            tStr = this.issueToken(token.musicId ?? 0, token.companyId ?? 0);
            t = this.fromWire(tStr)!;
            res.setHeader('X-Play-Token', tStr);
            res.setHeader('Set-Cookie', `pt=${encodeURIComponent(tStr)}; Path=/; HttpOnly; SameSite=Lax`);
        }

        // 3) 공통 값
        const durationSec = Math.max(1, Number(music?.duration ?? 0)); // DB: '초' 단위
        const durationMs = durationSec * 1000;
        const halfMs = durationMs / 2;
        const halfBytes = Math.floor(fileSize * 0.5);

        const isSmallFile = fileSize <= this.SMALL_FILE_THRESHOLD; // (기존) 3MB 이하
        const overshootCap = isSmallFile ? this.MICRO_OVERSHOOT : this.NORMAL_MIN_CHUNK;

        // 평균 비트레이트 기반 동적 청크
        const avgBps = Math.max(1, Math.floor(fileSize / durationSec));
        let dynamicMinChunk = Math.min(
            Math.max(Math.floor(avgBps * this.MIN_SEC_SLICE), this.NORMAL_MIN_CHUNK),
            512 * 1024
        );
        let dynamicMaxChunk = Math.min(
            Math.max(Math.floor(avgBps * this.MAX_SEC_SLICE), 256 * 1024),
            this.MAX_CHUNK_BASE
        );
        if (dynamicMaxChunk < dynamicMinChunk) dynamicMaxChunk = Math.max(dynamicMinChunk, 256 * 1024);

        // 4) 진행 상태 및 '최초 전송 시각' 앵커
        let maxSent = t.maxSent ?? 0;         // end+1 기준 누적 최댓값
        const preFirstSend = (maxSent === 0); // 최초 전송 여부
        if (preFirstSend) {
            t.startedAt = Date.now();           // 최초 전송 시각을 기준으로 모든 시간계산 고정
        }

        // 5) half 시각 '가변 오프셋' 계산: 고음질은 -20s, 저용량은 +20s
        //    - 비트레이트(kbps) 기반으로 구간별 선형 보간
        //    - 저용량 보정(+20s)을 합산하되 최종 [-20s, +20s]로 클램프
        const avgKbps = Math.floor((fileSize * 8) / durationSec / 1000); // 대략적 kbps
        const MAX_SKEW_MS = 20_000; // 20초
        let bitrateSkewMs = 0;
        // 구간 1: <=96kbps → +20s, 96~192kbps → +20s → 0s 선형
        if (avgKbps <= 96) {
            bitrateSkewMs = +MAX_SKEW_MS;
        } else if (avgKbps > 96 && avgKbps < 192) {
            const r = (avgKbps - 96) / (192 - 96); // 0..1
            bitrateSkewMs = Math.round(+MAX_SKEW_MS * (1 - r)); // +20s → 0s
        } else if (avgKbps >= 192 && avgKbps < 320) {
            // 구간 2: 192~320kbps → 0s → -20s 선형
            const r = (avgKbps - 192) / (320 - 192); // 0..1
            bitrateSkewMs = Math.round(-MAX_SKEW_MS * r); // 0s → -20s
        } else if (avgKbps >= 320) {
            bitrateSkewMs = -MAX_SKEW_MS;
        }
        // 저용량 보정(원하던 동작: 저용량은 느리게 +20s)
        const sizeSkewMs = isSmallFile ? +MAX_SKEW_MS : 0;

        // 합산하되 [-20s, +20s]로 클램프 (둘 다 걸려도 과도하게 치우치지 않게)
        // let skewMs = Math.max(-MAX_SKEW_MS, Math.min(MAX_SKEW_MS, bitrateSkewMs + sizeSkewMs));
        // (예) 전체적으로 8초 빨리 끝내고 싶다면:
        let skewMs: number = 40000;
        console.log(isSmallFile);
        // (예) 저용량만 +12초 늦추고 싶다면:
        // if (isSmallFile) skewMs += +60_000;
        // 목표 절반 시각(조정): halfAbsAdj
        const halfAbsAdj = t.startedAt + halfMs + skewMs;

        const alreadyOver50 = maxSent >= halfBytes;

        // 6) end 계산
        let end: number = 0;
        const nowTs = Date.now();

        // ===== pre-50%: 자유주행 + 50% 상한 =====
        if (!alreadyOver50) {
            if (start < (fileSize / 3)) {
                // 앞구간: 고정 256KB, 단 50%는 넘지 않음
                end = Math.min(start + this.EARLY_CHUNK - 1, HARD_MAX, halfBytes - 1);
            } else {
                // 일반 구간: 동적 최대, 단 50%는 넘지 않음
                end = Math.min(start + dynamicMaxChunk - 1, HARD_MAX, halfBytes - 1);

                // 최소 보장/overshoot
                if (!Number.isFinite(end) || end < start) {
                    end = clampEnd(start + overshootCap - 1);
                } else if (end < start + (isSmallFile ? this.MICRO_OVERSHOOT : dynamicMinChunk) - 1) {
                    end = clampEnd(start + (isSmallFile ? this.MICRO_OVERSHOOT : dynamicMinChunk) - 1);
                }

                if (end > halfBytes - 1) end = halfBytes - 1;
            }
        }

        // ===== post-50%: t50~halfAbsAdj 사이를 선형으로 100%까지 =====
        if (alreadyOver50) {
            const firstPostTurn = (!t.t50);
            const t50 = firstPostTurn ? nowTs : t.t50!;
            const b50 = firstPostTurn ? Math.max(halfBytes, maxSent) : (t.b50 ?? Math.max(halfBytes, maxSent));

            // halfAbsAdj 이전은 선형, 이후는 즉시 full 허용
            const denom = Math.max(200, halfAbsAdj - t50); // 최소 0.2s 방어
            const pPost = (nowTs >= halfAbsAdj) ? 1 : Math.min(Math.max((nowTs - t50) / denom, 0), 1);

            const allowedBytes = Math.min(fileSize, b50 + Math.floor((fileSize - b50) * pPost));
            const linearMaxEnd = clampEnd(allowedBytes - 1);
            const linearMinEnd = linearMaxEnd; // 상/하한 동일 → 조기완료 방지 + 즉시 catch-up

            if (start < (fileSize / 2)) {
                let proposed = Math.min(start + this.EARLY_CHUNK - 1, HARD_MAX, linearMaxEnd);
                if (proposed < linearMinEnd) proposed = linearMinEnd;
                end = proposed;
            } else {
                let imposedEnd = Math.min(start + dynamicMaxChunk - 1, HARD_MAX);
                if (imposedEnd > linearMaxEnd) imposedEnd = linearMaxEnd;
                if (imposedEnd < linearMinEnd) imposedEnd = linearMinEnd;

                // 최소 보장/overshoot
                if (!Number.isFinite(imposedEnd) || imposedEnd < start) {
                    imposedEnd = clampEnd(start + overshootCap - 1);
                    if (imposedEnd < linearMinEnd) imposedEnd = linearMinEnd;
                    if (imposedEnd > linearMaxEnd) imposedEnd = linearMaxEnd;
                } else if (imposedEnd < start + (isSmallFile ? this.MICRO_OVERSHOOT : dynamicMinChunk) - 1) {
                    imposedEnd = clampEnd(start + (isSmallFile ? this.MICRO_OVERSHOOT : dynamicMinChunk) - 1);
                    if (imposedEnd < linearMinEnd) imposedEnd = linearMinEnd;
                    if (imposedEnd > linearMaxEnd) imposedEnd = linearMaxEnd;
                }

                end = imposedEnd;
            }
        }

        // 파이널 세이프가드: start ≤ end ≤ fileSize-1
        if (!Number.isFinite(end) || end < start) {
            const minChunk = isSmallFile ? this.MICRO_OVERSHOOT : dynamicMinChunk;
            end = clampEnd(start + Math.max(minChunk, 1) - 1);
        }

        // 7) 진행 로그
        const chunkSize = end - start + 1;
        const progressPercentByBytes = Math.floor(((end + 1) / fileSize) * 100);
        console.log(
            `🎯 진행도: ${progressPercentByBytes}% (range ${start}-${end}, size ${chunkSize}) ` +
            `[kbps≈${avgKbps}] skew=${skewMs}ms small=${isSmallFile}`
        );

        // 8) 토큰 진행 업데이트 (+ t50/b50 기록)
        maxSent = Math.max(maxSent, end + 1);
        if (!t.t50 && maxSent >= halfBytes) {
            t.t50 = Date.now();
            t.b50 = maxSent;
        }
        t.maxSent = maxSent;

        // 9) 완료(유효재생)
        if (end >= fileSize - 1) {
            const normalizedRewardAmount = (rewardAmount == null || rewardAmount === '') ? 0 : rewardAmount;
            await this.musicService.recordValidPlayOnce({
                musicId: music.id,
                companyId,
                useCase: music.inst ? '1' : '0',
                rewardCode: rewardInfo,
                musicPlayId,
                rewardAmount: normalizedRewardAmount,
            });
        }

        // 10) 206 Partial + 토큰/쿠키 + 캐시정책
        res.status(206);
        this.setNoCacheHeaders(res, tStr);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunkSize);
        res.setHeader('Content-Type', 'audio/mpeg');

        const updatedTokenStr = this.toWire(t);
        res.setHeader('X-Play-Token', updatedTokenStr);
        res.setHeader('Set-Cookie', `pt=${encodeURIComponent(updatedTokenStr)}; Path=/; HttpOnly; SameSite=Lax`);

        const stream = createReadStream(filePath, { start, end });
        return new StreamableFile(stream);
    }

}
