import { Controller, Get, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ExploreService } from './explore.service';

function pickBearer(req: any): string | null {
  const h = req.headers?.authorization || req.headers?.Authorization;
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7);
  const cookie = req.cookies?.mps_at;
  return cookie ?? null;
}

@Controller('explore')
export class ExploreController {
  constructor(
    private readonly explore: ExploreService,
    private readonly jwt: JwtService,
  ) {}

  @Get('sections')
  async getSections(@Req() req: any) {
    // 토큰이 있으면만 검증(없으면 게스트 free)
    const token = pickBearer(req);
    let user: any = null;
    if (token) {
      try { user = await this.jwt.verifyAsync(token); } catch {}
    }
    const isAuth = !!user;
    const companyId = Number(user?.sub ?? 0);
    const grade = (user?.grade ?? 'free') as 'free'|'standard'|'business';
    return this.explore.getSections(companyId, grade, isAuth);
  }
}
