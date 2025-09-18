import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Res, UseInterceptors, UploadedFiles, BadRequestException, ValidationPipe } from '@nestjs/common';
import { MusicsService } from './musics.service';
import type { Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import * as fs from 'fs';

// DTOs
import {
  CreateMusicDto,
  UpdateMusicDto,
  FindMusicsDto,
  DeleteMusicsDto,
  UpdateRewardDto,
  CreateCategoryDto,
  MusicRewardsSummaryQueryDto,
  MusicRewardsTrendQueryDto,
  MusicMonthlyRewardsQueryDto,
  MusicCompanyUsageQueryDto,
  MusicTotalStatsQueryDto,
  PlaysValidStatsQueryDto,
  RevenueForecastQueryDto,
  RewardsFilledStatsQueryDto,
  CategoryTop5QueryDto,
  RealtimeApiStatusQueryDto,
  RealtimeTopTracksQueryDto,
  RealtimeTransactionsQueryDto
} from './dto';

@Controller('/admin/musics')
export class MusicsController {
  constructor(private readonly musicsService: MusicsService) { }

  @Get()
  async findAll(@Query() findMusicsDto: any) {
    return this.musicsService.findAll(findMusicsDto);
  }

  @Get('categories')
  async getCategories() {
    return this.musicsService.getCategories();
  }

  @Get('rewards/summary')
  async getRewardsSummary(@Query(new ValidationPipe({ transform: true })) query: MusicRewardsSummaryQueryDto) {
    return this.musicsService.getRewardsSummary(query);
  }

  @Get(':id/rewards/trend')
  async getRewardsTrend(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: MusicRewardsTrendQueryDto,
  ) {
    return this.musicsService.getRewardsTrend(+id, query);
  }

  @Get(':id/rewards/monthly')
  async getMonthlyRewards(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: MusicMonthlyRewardsQueryDto,
  ) {
    return this.musicsService.getMonthlyRewards(+id, query);
  }

  @Get(':id/rewards/companies')
  async getCompanyUsage(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true })) query: MusicCompanyUsageQueryDto,
  ) {
    return this.musicsService.getCompanyUsage(+id, query);
  }

  @Get('stats/total')
  async getTotalStats(@Query(new ValidationPipe({ transform: true })) query: MusicTotalStatsQueryDto) {
    return this.musicsService.getTotalCount(query);
  }

  @Get('stats/plays/valid')
  async getValidPlaysStats(@Query(new ValidationPipe({ transform: true })) query: PlaysValidStatsQueryDto) {
    return this.musicsService.getValidPlaysStats(query);
  }


  @Get('stats/revenue/forecast')
  async getRevenueForecast(@Query(new ValidationPipe({ transform: true })) query: RevenueForecastQueryDto) {
    return this.musicsService.getRevenueForecast(query);
  }

  @Get('stats/rewards/filled')
  async getRewardsFilled(@Query(new ValidationPipe({ transform: true })) query: RewardsFilledStatsQueryDto) {
    return this.musicsService.getRewardsFilledStats(query);
  }


  @Get('realtime/api-status')
  async getRealtimeApiStatus(@Query(new ValidationPipe({ transform: true })) query: RealtimeApiStatusQueryDto) {
    return this.musicsService.getRealtimeApiStatus(query);
  }

  @Get('realtime/api-calls')
  async getRealtimeApiCalls(@Query(new ValidationPipe({ transform: true })) query: RealtimeApiStatusQueryDto) {
    return this.musicsService.getRealtimeApiCalls(query);
  }

  @Get('stats/category-top5')
  async getCategoryTop5(@Query(new ValidationPipe({ transform: true })) query: CategoryTop5QueryDto) {
    return this.musicsService.getCategoryTop5(query);
  }

  @Get('realtime/top-tracks')
  async getRealtimeTopTracks(@Query(new ValidationPipe({ transform: true })) query: RealtimeTopTracksQueryDto) {
    return this.musicsService.getRealtimeTopTracks(query);
  }

  @Get('realtime/transactions')
  async getRealtimeTransactions(@Query(new ValidationPipe({ transform: true })) query: RealtimeTransactionsQueryDto) {
    return this.musicsService.getRealtimeTransactions(query);
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('카테고리 이름은 필수입니다.');
    return this.musicsService.createCategory({ ...dto, name });
  }

  @Post()
  create(@Body() createMusicDto: CreateMusicDto) {
    return this.musicsService.create(createMusicDto);
  }

  @Post('upload')
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'audio', maxCount: 1 },
    { name: 'lyrics', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
  ], { storage: memoryStorage() }))
  async upload(
    @UploadedFiles() files: { audio?: Express.Multer.File[]; lyrics?: Express.Multer.File[]; cover?: Express.Multer.File[] }
  ) {
    return this.musicsService.saveUploadedFiles(files);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    // ID 유효성 검사
    const musicId = +id;
    if (isNaN(musicId) || musicId <= 0) {
      throw new BadRequestException('유효하지 않은 음원 ID입니다.');
    }
    return this.musicsService.findOne(musicId);
  }

  @Patch(':id/rewards')
  async updateRewards(@Param('id') id: string, @Body() dto: UpdateRewardDto) {
    return this.musicsService.updateNextMonthRewards(+id, dto);
  }

  @Get(':id/cover')
  async getCover(@Param('id') id: string, @Res() res: Response) {
    try {
      const file = await this.musicsService.getCoverFile(+id);
      if (file.isUrl && file.url) {
        return res.redirect(file.url);
      }
      if (file.absPath && file.contentType) {
        res.setHeader('Content-Type', file.contentType);
        return fs.createReadStream(file.absPath).pipe(res);
      }
      return res.status(404).send('커버 이미지가 없습니다.');
    } catch (error) {
      console.error('커버 이미지 로드 실패:', error.message);
      return res.status(404).send('커버 이미지를 찾을 수 없습니다.');
    }
  }

  @Get(':id/lyrics')
  async getLyrics(
    @Param('id') id: string,
    @Query('mode') mode: 'inline' | 'download' = 'inline',
    @Res() res: Response
  ) {
    try {
      const info = await this.musicsService.getLyricsFileInfo(+id);

      if (info.hasText && info.text) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (mode === 'download') {
          res.setHeader('Content-Disposition', `attachment; filename="lyrics.txt"`);
        }
        return res.send(info.text);
      }

      if (info.hasFile && info.absPath && info.filename) {
        res.setHeader('Content-Type', 'text/plain');
        if (mode === 'download') {
          res.setHeader('Content-Disposition', `attachment; filename="${info.filename}"`);
        }
        return fs.createReadStream(info.absPath).pipe(res);
      }

      return res.status(404).send('가사 파일을 찾을 수 없습니다.');
    } catch (error) {
      console.error('가사 파일 로드 실패:', error.message);
      return res.status(404).send('가사 파일을 찾을 수 없습니다.');
    }
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMusicDto: UpdateMusicDto) {
    return this.musicsService.update(+id, updateMusicDto);
  }

  @Delete('delete')
  async delete(@Body() deleteDto: DeleteMusicsDto) {
    return this.musicsService.delete(deleteDto.ids);
  }
}
