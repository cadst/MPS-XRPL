// /src/lib/stores/auth.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { me as fetchMeApi, login as loginApi, logout as logoutApi } from '@/lib/api';
import type { AuthMe, LoginDto, LoginResp } from '@/lib/api/auth';
import { getAccessToken, setAccessToken, clearAccessToken } from '../api/auth/token';

type AuthState = {
  profile: AuthMe | null;
  loading: boolean;
  error: string | null;
  // actions
  fetchMe: () => Promise<void>;
  login: (dto: LoginDto) => Promise<LoginResp>;
  logout: () => Promise<void>;
  setProfile: (p: AuthMe | null) => void;
};

export const useAuthStore = create<AuthState>()(
  devtools((set, get) => ({
    profile: null,
    loading: false,
    error: null,

    async fetchMe() {
      const token = getAccessToken();
      if (!token) { set({ profile: null, loading: false, error: null }); return; }
      set({ loading: true, error: null });
      try {
        const p = await fetchMeApi(); // /auth/me (존재하면 반환, 401이면 null 리턴 권장)
        set({ profile: p ?? null, loading: false });
      } catch (e: any) {
        set({ profile: null, loading: false, error: String(e?.message ?? e) });
      }
    },

    async login(dto) {
      const resp = await loginApi(dto);          // 서버 로그인
      setAccessToken(resp.accessToken);          // 토큰 저장
      await get().fetchMe();                     // 즉시 me 갱신
      window.dispatchEvent(new Event('mps:auth:changed')); // 필요 시 다른 컴포넌트 알림
      return resp;
    },

    async logout() {
      try { await logoutApi(); } catch {}
      clearAccessToken();
      set({ profile: null });
      window.dispatchEvent(new Event('mps:auth:changed'));
    },

    setProfile(p) { set({ profile: p }); },
  }))
);
