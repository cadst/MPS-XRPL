// apps/backend/src/client/musics/musics.controller.ts
import {
  Controller,
  Get,
  Query,
  Req,
  Post,
  Param,
  UnauthorizedException,
  Res,
  NotFoundException,
  ForbiddenException,
  ParseIntPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { MusicsService } from './musics.service';
import { ListMusicQueryDto, normalizeListQuery } from './dto/list-music.query.dto';
import { PopularMusicDto } from './dto/popular-music.dto';
import { CategoryDto } from './dto/category.dto';
import { MusicDetailDto, UseMusicResponseDto } from './dto/music-detail.dto';

@ApiTags('musics')
@Controller('musics')
export class MusicsController {
  constructor(private readonly musics: MusicsService, private readonly jwt: JwtService) {}

  @Get()
  @ApiOkResponse({
    schema: {
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/PopularMusicDto' } },
        nextCursor: { type: 'string', nullable: true },
        hasMore: { type: 'boolean', nullable: true }, // 서비스에서 내려주면 프론트가 활용
      },
    },
  })
  async list(
    @Req() req: any,
    @Query() query: ListMusicQueryDto
  ): Promise<{ items: PopularMusicDto[]; nextCursor: string | null; hasMore?: boolean }> {
    // 토큰 복호화 (Bearer 우선, 없으면 쿠키)
    const token = req.headers?.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : (req.cookies?.mps_at ?? null);

    let user: any = null;
    if (token) {
      try {
        user = await this.jwt.verifyAsync(token);
      } catch {}
    }

    const isAuth = !!user;
    const companyId = Number(user?.sub ?? 0);
    const grade = (user?.grade ?? 'free') as 'free' | 'standard' | 'business';

    const qnorm = normalizeListQuery(query);

    return this.musics.searchList({ companyId, grade, isAuth, query: qnorm });
  }

  @Get('categories')
  @ApiOkResponse({
    schema: { properties: { items: { type: 'array', items: { $ref: '#/components/schemas/CategoryDto' } } } },
  })
  async categories(): Promise<{ items: CategoryDto[] }> {
    const items = await this.musics.listCategories();
    return { items };
  }

  @Get('popular')
  @ApiOkResponse({
    schema: {
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/PopularMusicDto' } },
      },
    },
  })
  async popular(
    @Req() req: any,
    @Query() q: { category?: string | number; limit?: number }
  ): Promise<{ items: PopularMusicDto[] }> {
    const token = req.headers?.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : (req.cookies?.mps_at ?? null);

    let user: any = null;
    if (token) {
      try {
        user = await this.jwt.verifyAsync(token);
      } catch {}
    }

    const isAuth = !!user;
    const companyId = Number(user?.sub ?? 0);
    const grade = (user?.grade ?? 'free') as 'free' | 'standard' | 'business';

    const dto: ListMusicQueryDto = {
      sort: 'most_played',
      category_id: q.category != null ? String(q.category) : undefined,
      limit: (q.limit as any) ?? 12,
    } as any;
    const qnorm = normalizeListQuery(dto);

    const resp = await this.musics.searchList({ companyId, grade, isAuth, query: qnorm });
    return { items: resp.items };
  }

  @Get('tags')
  async getTagsBulk(@Query('ids') ids: string) {
    const arr = (ids ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));

    if (!arr.length) return [];
    const limited = arr.slice(0, 200); // 과도한 요청 방지
    return this.musics.getTagsBulk(limited); // ← 프론트가 기대하는 형태(map/array)는 서비스와 합의된 그대로 반환
  }

  @Get('raw-tags')
  async listRawTags(@Query('type') type: 'mood' | 'genre' | 'context' = 'mood') {
    const items = await this.musics.listRawTagChips(type);
    return { items }; // { items: RawTagChip[] }
  }

  @Get(':id')
  @ApiOkResponse({ type: MusicDetailDto })
  async getOne(@Req() req: any, @Param('id') id: string): Promise<MusicDetailDto> {
    const token =
      req.headers?.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : (req.cookies?.mps_at ?? null);

    let user: any = null;
    if (token) {
      try {
        user = await this.jwt.verifyAsync(token);
      } catch {}
    }

    if (!user) {
      throw new UnauthorizedException('LOGIN_REQUIRED');
    }

    const isAuth = !!user;
    const companyId = Number(user?.sub ?? 0);
    const grade = (user?.grade ?? 'free') as 'free' | 'standard' | 'business';

    return this.musics.getDetail({ companyId, grade, isAuth, musicId: Number(id) });
  }

  @Post(':id/use')
  @ApiOkResponse({ type: UseMusicResponseDto })
  async use(@Req() req: any, @Param('id') id: string): Promise<UseMusicResponseDto> {
    const token =
      req.headers?.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : (req.cookies?.mps_at ?? null);

    let user: any = null;
    if (token) {
      try {
        user = await this.jwt.verifyAsync(token);
      } catch {}
    }
    if (!user) {
      const { UnauthorizedException } = await import('@nestjs/common');
      throw new UnauthorizedException('LOGIN_REQUIRED');
    }
    return this.musics.useMusic(Number(user.sub), Number(id));
  }

  @Get(':id/lyrics')
  async getLyrics(@Req() req: any, @Param('id') id: string) {
    const token = req.headers?.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : (req.cookies?.mps_at ?? null);

    let user: any = null;
    if (token) {
      try {
        user = await this.jwt.verifyAsync(token);
      } catch {}
    }
    if (!user) throw new UnauthorizedException('LOGIN_REQUIRED');

    try {
      const { text } = await this.musics.getLyricsText({
        companyId: Number(user.sub),
        grade: (user.grade ?? 'free') as any,
        isAuth: true,
        musicId: Number(id),
      });
      return { text };
    } catch (e: any) {
      if (e?.message === 'NO_LYRICS') throw new NotFoundException('NO_LYRICS');
      if (e?.message === 'SUBSCRIPTION_REQUIRED') throw new ForbiddenException('SUBSCRIPTION_REQUIRED');
      if (e?.message === 'NOT_FOUND') throw new NotFoundException('NOT_FOUND');
      throw e;
    }
  }

  @Get(':id/lyrics.txt')
  async downloadLyrics(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const token = req.headers?.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : (req.cookies?.mps_at ?? null);

    let user: any = null;
    if (token) {
      try {
        user = await this.jwt.verifyAsync(token);
      } catch {}
    }
    if (!user) throw new UnauthorizedException('LOGIN_REQUIRED');

    try {
      const { text, filename } = await this.musics.downloadLyricsAndCount({
        companyId: Number(user.sub),
        grade: (user.grade ?? 'free') as any,
        isAuth: true,
        musicId: Number(id),
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      return res.send(Buffer.from(text, 'utf8'));
    } catch (e: any) {
      const m = e?.message;
      if (m === 'LOGIN_REQUIRED') throw new UnauthorizedException('LOGIN_REQUIRED');
      if (m === 'SUBSCRIPTION_REQUIRED') throw new ForbiddenException('SUBSCRIPTION_REQUIRED');
      if (m === 'NO_LYRICS' || m === 'NOT_FOUND') throw new NotFoundException(m);
      throw e;
    }
  }
  @Get(':musicId/tags')
  async listTags(@Param('musicId') musicId: string) {
    return this.musics.getMusicTags(Number(musicId));
  }
  @Post(':id/plays/start')
  async startPlay(@Param('id', ParseIntPipe) id: number) {
    const filePath = await this.musics.getPlayUrl(id);
    if (!filePath) throw new NotFoundException('AUDIO_NOT_FOUND');
    return { file_path: filePath };
  }
}
