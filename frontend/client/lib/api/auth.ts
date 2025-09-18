  import { api } from './core/http';

  export type LoginDto = { email: string; password: string };

  export type LoginResp = {
    tokenType: 'Bearer';
    accessToken: string;
    expiresIn: number;
    company: {
      id: number;
      name: string;
      email: string;
      grade: string;
      profile_image_url: string | null;
      subscriptionStatus: string | null;
    };
  };

  // /auth/me 가 JWT 페이로드 + DB 최신 프로필을 합쳐서 주므로 넉넉히 타입 정의
  export type AuthMe = {
    sub: number;
    grade: string;
    name?: string;
    email?: string;
    profile_image_url?: string | null;
    subscriptionStatus?: string | null;
    // 아래는 마이페이지용으로 함께 내려올 수 있는 필드들
    id?: number;
    business_number?: string | null;
    phone?: string | null;
    homepage_url?: string | null;
    created_at?: string | null;
    // JWT 표준 클레임(선택)
    iat?: number;
    exp?: number;
  };

  export const login = (dto: LoginDto) =>
    api('/auth/login', { method: 'POST', body: JSON.stringify(dto) }) as Promise<LoginResp>;

  export const logout = () =>
    api('/auth/logout', { method: 'POST' }).then(() => undefined);

  export const me = () => api('/auth/me') as Promise<AuthMe>;