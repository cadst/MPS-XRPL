// apps/backend/src/client/musics/musics.controller.ts
import { Controller, Get, Query, Req, Post, Param  } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import { MusicsService } from './musics.service';
import { ListMusicQueryDto } from './dto/list-music.query.dto';
import { PopularMusicDto } from './dto/popular-music.dto';
import { CategoryDto } from './dto/category.dto';
import { MusicDetailDto, UseMusicResponseDto } from './dto/music-detail.dto';
@ApiTags('musics')
@Controller('musics')
export class MusicsController {
  constructor(private readonly musics: MusicsService, private readonly jwt: JwtService) {}

  @Get()
  @ApiOkResponse({ schema: { properties: {
    items: { type: 'array', items: { $ref: '#/components/schemas/PopularMusicDto' } },
    nextCursor: { type: 'string', nullable: true }
  }}})
  async list(@Req() req: any, @Query() query: ListMusicQueryDto)
  : Promise<{items: PopularMusicDto[]; nextCursor: string|null}> {
    const token = req.headers?.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : (req.cookies?.mps_at ?? null);
    let user: any = null; if (token) { try { user = await this.jwt.verifyAsync(token); } catch {} }
    const isAuth = !!user;
    const companyId = Number(user?.sub ?? 0);
    const grade = (user?.grade ?? 'free') as 'free'|'standard'|'business';
    return this.musics.searchList({ companyId, grade, isAuth, query });
  }

  @Get('categories')
  @ApiOkResponse({ schema: { properties: {
    items: { type: 'array', items: { $ref: '#/components/schemas/CategoryDto' } }
  }}})
  async categories(): Promise<{ items: CategoryDto[] }> {
    const items = await this.musics.listCategories();
    return { items };
  }

  @Get('popular')
  @ApiOkResponse({ schema: { properties: {
    items: { type: 'array', items: { $ref: '#/components/schemas/PopularMusicDto' } }
  }}})
  async popular(@Req() req: any, @Query() q: { category?: string|number; limit?: number })
  : Promise<{ items: PopularMusicDto[] }> {
    const token = req.headers?.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : (req.cookies?.mps_at ?? null);
    let user: any = null; if (token) { try { user = await this.jwt.verifyAsync(token); } catch {} }
    const isAuth = !!user;
    const companyId = Number(user?.sub ?? 0);
    const grade = (user?.grade ?? 'free') as 'free'|'standard'|'business';

    const items = (await this.musics.searchList({
      companyId,
      grade,
      isAuth,
      query: {
        sort: 'most_played',
        category_id: q.category as any,
        limit: q.limit ?? 12,
      } as any
    })).items;

    return { items };
  }
  @Get(':id')
  @ApiOkResponse({ type: MusicDetailDto })
  async getOne(@Req() req: any, @Param('id') id: string): Promise<MusicDetailDto> {
    const token =
      req.headers?.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : (req.cookies?.mps_at ?? null);

    let user: any = null;
    if (token) { try { user = await this.jwt.verifyAsync(token); } catch {} }

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
    if (token) { try { user = await this.jwt.verifyAsync(token); } catch {} }
    if (!user) {
      const { UnauthorizedException } = await import('@nestjs/common');
      throw new UnauthorizedException('LOGIN_REQUIRED');
    }
    return this.musics.useMusic(Number(user.sub), Number(id));
  }
}
