// src/modules/auth/auth.controller.ts
import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CompaniesService } from '../companies/companies.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly companies: CompaniesService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
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
    return { ok: true, company: resp.company, tokenType: resp.tokenType, expiresIn: resp.expiresIn };
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
    const profile = await this.companies.getProfileById(user.sub).catch(() => null);
    if (!profile) return user;

    return {
      ...user,
      id: profile.id,
      name: profile.name ?? user.name,
      email: profile.email ?? user.email,
      profile_image_url: profile.profile_image_url ?? user.profile_image_url ?? null,
      business_number: (profile as any).business_number ?? null,
      phone: (profile as any).phone ?? null,
      homepage_url: (profile as any).homepage_url ?? null,
      created_at: (profile as any).created_at ?? null,
    };
  }
}
