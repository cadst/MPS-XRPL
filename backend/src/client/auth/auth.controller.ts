// src/modules/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CompaniesService } from '../companies/companies.service';
import { randomBytes } from 'node:crypto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly companies: CompaniesService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const resp = await this.auth.login(dto.email, dto.password);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('mps_at', resp.accessToken, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      path: '/',
      maxAge: resp.expiresIn * 1000,
    });

    // 프론트 편의를 위해 회사 정보는 그대로 반환
    return {
      ok: true,
      company: resp.company,
      tokenType: resp.tokenType,
      expiresIn: resp.expiresIn,
    };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Res({ passthrough: true }) res: Response) {
    // 쿠키 삭제(선택)
    res.clearCookie('mps_at', { path: '/' });
    return;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const user = req.user as any;
    const profile = await this.companies
      .getProfileById(user.sub)
      .catch(() => null);
    if (!profile) return user;

    return {
      ...user,
      id: profile.id,
      name: profile.name ?? user.name,
      email: profile.email ?? user.email,
      profile_image_url:
        profile.profile_image_url ?? user.profile_image_url ?? null,
      business_number: (profile as any).business_number ?? null,
      phone: (profile as any).phone ?? null,
      homepage_url: (profile as any).homepage_url ?? null,
      created_at: (profile as any).created_at ?? null,
    };
  }
  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const isProd = process.env.NODE_ENV === 'production';
    const authed = req.user as any; // JwtAuthGuard가 파싱한 기존 토큰
    const company = await this.companies.getProfileById(authed.sub); // DB에서 최신 상태

    const {
      accessToken,
      expiresIn,
      company: mini,
    } = await this.auth.issueAccessTokenFromCompany(company);

    res.cookie('mps_at', accessToken, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      path: '/',
      maxAge: expiresIn * 1000,
    });

    return { ok: true, company: mini, expiresIn };
  }

  @Post('quick-register')
  @HttpCode(200)
  async quickRegister(@Res({ passthrough: true }) res: Response) {
    // 랜덤 자격 생성
    const email = `tester_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
    const password = randomBytes(5).toString('hex'); // 10자리 정도

    // 완화 모드에서 통과하도록 가짜 데이터
    const dto = {
      name: `테스터-${Math.random().toString(36).slice(2, 6)}`,
      business_number: '111-22-33333',
      email,
      password,
      phone: '010-0000-0000',
      ceo_name: 'Test CEO',
      profile_image_url: '',
      homepage_url: '',
    } as any;

    // 회원 생성 (BIZNO_RELAXED=1 권장)
    const created = await this.companies.create(dto, /*skipNts*/ true);

    // 자동 로그인 토큰 발급
    const login = await this.auth.login(email, password);
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('mps_at', login.accessToken, {
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      secure: isProd,
      path: '/',
      maxAge: login.expiresIn * 1000,
    });

    return {
      ok: true,
      email,
      password,
      company: login.company,
      xrpl: created?.xrpl ?? null,
      note: '이메일/비밀번호는 테스트용으로만 사용하세요.',
    };
  }
}
