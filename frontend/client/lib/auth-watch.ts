// lib/auth-watch.ts (새 파일)
import { api } from "@/lib/api/core/http";

let timer: number | null = null;

export function startAuthWatch() {
  // 탭이 포커스될 때 확인
  const onFocus = async () => {
    try {
      // 만료/로그아웃이면 여기서 401 → 아래 catch로 빠짐
      await api("/auth/me", { method: "GET", skipAuthRedirect: true });
    } catch (e: any) {
      // 401이면 http.ts의 api()에서 이미 에러를 던졌을 것 → 여기서 로그인으로 보내기
      // goLogin은 api() 내부에서 호출하므로 여기선 아무 것도 안 해도 됨
      // 혹시 커스텀이 필요하면 e.code === 'unauthorized' 인지 체크 후 처리
    }
  };

  window.addEventListener("focus", onFocus);

  // 주기적 체크(예: 10분마다). 탭 비활성화 상태에선 브라우저가 자동으로 타이머 느리게 돌림
  if (!timer) {
    timer = window.setInterval(onFocus, 10 * 60 * 1000) as unknown as number;
  }

  return () => {
    window.removeEventListener("focus", onFocus);
    if (timer) { clearInterval(timer); timer = null; }
  };
}
