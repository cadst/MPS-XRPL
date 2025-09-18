// lib/http.ts
const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';
if (!RAW_BASE) throw new Error('NEXT_PUBLIC_API_BASE 가 비어 있습니다 (.env.local 설정 필요).');
const BASE = RAW_BASE.replace(/\/+$/, '');

function join(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

function isAuthFreePath(pathname: string) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/reset') ||
    pathname.startsWith('/public')
  );
}

function goLogin(reason = 'unauthorized') {
  try {
    if (typeof window === 'undefined') return;

    const { pathname, search } = window.location;
    if (isAuthFreePath(pathname)) return;

    const key = 'auth-redirect-ts';
    const now = Date.now();
    const last = Number(sessionStorage.getItem(key) || '0');
    if (now - last < 1500) return;
    sessionStorage.setItem(key, String(now));

    if (!sessionStorage.getItem('returnTo')) {
      sessionStorage.setItem('returnTo', pathname + search);
    }

    window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
  } catch {}
}

async function readBody(res: Response) {
  if (res.status === 204 || res.status === 205) return null;

  const ct = res.headers.get('content-type') || '';
  const looksJson = ct.includes('application/json');

  try {
    return looksJson ? await res.json() : await res.text();
  } catch {
    try {
      return await res.text();
    } catch {
      return null;
    }
  }
}

async function parseJsonOrText(res: Response) {
  const body = await readBody(res);

  if (!res.ok) {
    const msg = typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body);
    const err = Object.assign(new Error(msg || `HTTP ${res.status}`), { response: res, body });
    throw err;
  }

  if (typeof body === 'string') {
    throw new Error(`Non-JSON response: ${body.slice(0, 200)}`);
  }
  return body;
}

let isRefreshing = false;
let refreshWaiters: Array<() => void> = [];

/** 조용히 토큰 재발급 (실패해도 throw 안 함) */
async function trySilentRefresh(): Promise<void> {
  if (isRefreshing) {
    await new Promise<void>((resolve) => refreshWaiters.push(resolve));
    return;
  }
  isRefreshing = true;
  try {
    await fetch(join('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }).catch(() => {});
  } finally {
    isRefreshing = false;
    refreshWaiters.forEach((fn) => fn());
    refreshWaiters = [];
  }
}

/** 로그인 없이도 호출 가능한 새 토큰 발급 (명시 호출용) */
export async function refreshAuth() {
  try {
    await fetch(join('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch {}
}

/** 강제 권한 갱신 플로우(동일 탭 이동) */
export function forceAuthRefresh(reason = 'refresh') {
  try {
    if (typeof window === 'undefined') return;
    const { pathname, search } = window.location;
    if (!sessionStorage.getItem('returnTo')) {
      sessionStorage.setItem('returnTo', pathname + search);
    }
    window.location.href = `/login?reason=${encodeURIComponent(reason)}`;
  } catch {}
}

export async function api(
  path: string,
  init: (RequestInit & { skipAuthRedirect?: boolean; __retriedOnce?: boolean }) = {}
) {
  const headers: Record<string, string> = { Accept: 'application/json', ...(init.headers as any) };

  const hasBody = init.body !== undefined && init.body !== null;
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const isUrlParams = typeof URLSearchParams !== 'undefined' && init.body instanceof URLSearchParams;

  if (hasBody && !isFormData && !isUrlParams && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }

  const res = await fetch(join(path), {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers,
  });

  if (res.status === 401) {
    // reason 파싱
    let reason = 'unauthorized';
    try {
      const cloned = res.clone();
      const maybeJson = await cloned.json().catch(() => null);
      if (maybeJson?.code) reason = String(maybeJson.code); // e.g., 'token_expired'
    } catch {}

    // 1) skipAuthRedirect가 아니고, 아직 재시도 한 번도 안 했다면 → silent refresh 후 1회 재시도
    if (!init.skipAuthRedirect && !init.__retriedOnce) {
      await trySilentRefresh();
      const retryRes = await fetch(join(path), {
        credentials: 'include',
        cache: 'no-store',
        ...init,
        headers,
        // 무한루프 방지용 플래그
        __retriedOnce: true as any,
      } as RequestInit);

      if (retryRes.ok) {
        return parseJsonOrText(retryRes);
      }

      // 재시도도 401이면 로그인으로 보냄
      if (retryRes.status === 401) {
        if (!init.skipAuthRedirect) goLogin(reason);
        const body = await readBody(retryRes);
        const msg = typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body);
        const err = Object.assign(new Error(msg || 'Unauthorized'), { response: retryRes, body, code: reason });
        throw err;
      }

      // 재시도는 했지만 다른 오류라면 그대로 throw
      return parseJsonOrText(retryRes);
    }

    // 2) (재시도 이미 했거나 skipAuthRedirect=true) → 바로 로그인 이동 or 에러 throw
    if (!init.skipAuthRedirect) {
      goLogin(reason); // /login?reason=token_expired 등
    }
    const body = await readBody(res);
    const msg = typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body);
    const err = Object.assign(new Error(msg || 'Unauthorized'), { response: res, body, code: reason });
    throw err;
  }

  return parseJsonOrText(res);
}

/** multipart/form-data (Content-Type 지정 금지) */
export async function apiForm(path: string, form: FormData, init: RequestInit = {}) {
  const res = await fetch(join(path), {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    body: form,
    ...init,
  });
  return parseJsonOrText(res);
}

export function qs(params: Record<string, any>) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) s.set(k, String(v)); });
  return s.toString();
}
export async function apiOrNull<T = any>(
  path: string,
  init: RequestInit & { skipAuthRedirect?: boolean } = {}
): Promise<T | null> {
  try {
    return await api(path, { ...init, skipAuthRedirect: true }) as T;
  } catch (e: any) {
    // api()에서 401이면 Error 던지는데, 여기선 null로 치환
    const status = e?.response?.status ?? e?.status;
    if (status === 401) return null;
    throw e;
  }
}