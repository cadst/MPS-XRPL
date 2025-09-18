import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CompaniesService } from '../companies/companies.service';

// JWT에 담아 줄 페이로드 타입
type AccessPayload = {
  sub: number; // 회사 id (숫자 권장)
  grade: string;
  subscriptionStatus?: string | null;
  name?: string;
  email?: string;
  profile_image_url?: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly companies: CompaniesService,
    private readonly jwt: JwtService,
  ) { }

  // 필요하면 외부에서 직접 호출
  async validate(email: string, password: string) {
    return this.companies.validateByEmailPassword(email, password);
  }

  async login(email: string, password: string) {
    const company = await this.companies.validateByEmailPassword(email, password);
    if (!company) throw new UnauthorizedException('Invalid credentials');

    const payload: AccessPayload = {
      sub: company.id,
      grade: company.grade,
      subscriptionStatus: company.subscriptionStatus ?? null,
      name: company.name,
      email: company.email,
      profile_image_url: company.profile_image_url ?? null,
    };

    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '1h' });

    return {
      tokenType: 'Bearer',
      accessToken,
      expiresIn: 100000,
      // 프론트 편의용 미니 프로필
      company: {
        id: company.id,
        name: company.name,
        email: company.email,
        grade: company.grade,
        profile_image_url: company.profile_image_url ?? null,
        subscriptionStatus: company.subscriptionStatus ?? null,
      },
    };
  }
  async issueAccessTokenFromCompany(company: any) {
    const payload: AccessPayload = {
      sub: company.id,
      grade: company.grade,
      subscriptionStatus: company.subscriptionStatus ?? null,
      name: company.name,
      email: company.email,
      profile_image_url: company.profile_image_url ?? null,
    };

    // 토큰 만료를 1h로, "expiresIn" 숫자도 3600(초)로 통일
    const jwtTtlSec = 3600; // 1 hour
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: `${jwtTtlSec}s` });

    return {
      tokenType: 'Bearer',
      accessToken,
      expiresIn: jwtTtlSec, // ← 숫자(초)로 반환, 컨트롤러에서 maxAge *1000로 사용
      company: {
        id: company.id,
        name: company.name,
        email: company.email,
        grade: company.grade,
        profile_image_url: company.profile_image_url ?? null,
        subscriptionStatus: company.subscriptionStatus ?? null,
      },
    };
  }
}