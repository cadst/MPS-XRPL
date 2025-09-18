export function normalizeLoginError(e: any) {
    const msg = String(e?.message || e || '');
    if (/Unauthorized|Invalid credentials|401/.test(msg)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
    if (/Failed to fetch|NetworkError|ERR_CONNECTION/.test(msg)) return '서버에 연결할 수 없습니다. 잠시 후 다시 시도하세요.';
    return '로그인 중 오류가 발생했습니다.';
  }