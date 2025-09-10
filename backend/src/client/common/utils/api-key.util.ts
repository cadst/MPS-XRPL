import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

export type ApiKeyGenerateResult = {
  key: string;     // 평문 (1회만 노출)
  last4: string;   // UI 표시용
  kid: string;     // DB 조회용
  version: number; // 버전
  hash: string;    // DB 저장용 해시
};

@Injectable()
export class ApiKeyUtil {
  constructor(private readonly config: ConfigService) {}

  // sk_(live|test)_v<ver>_<kid>_<secret>
  private static KEY_RE =
    /^(?<prefix>sk_(?:live|test))_v(?<ver>\d+)_(?<kid>[A-Za-z0-9_-]{8,})_(?<secret>[A-Za-z0-9_-]{32,})$/;

  /** ✅ 반드시 존재해야 하는 메서드 */
  generate(mode: 'live' | 'test' = 'live'): ApiKeyGenerateResult {
    const prefix = (this.config.get('API_KEY_PREFIX') ?? `sk_${mode}`) as 'sk_live' | 'sk_test';
    const version = Number(this.config.get('API_KEY_VERSION') ?? 1);
    const kid = randomBytes(6).toString('base64url');      // 8자
    const secret = randomBytes(32).toString('base64url');  // 길게
    const key = `${prefix}_v${version}_${kid}_${secret}`;
    const last4 = secret.slice(-4);
    const hash = this.hash(key);
    return { key, last4, kid, version, hash };
  }

  hash(apiKeyPlain: string): string {
    const pepper = this.requirePepper();
    const salt = randomBytes(16).toString('hex');
    const mac = createHmac('sha256', pepper).update(`${apiKeyPlain}:${salt}`).digest('hex');
    return `${salt}:${mac}`;
  }

  verify(apiKeyPlain: string, storedHash: string): boolean {
    const pepper = this.requirePepper();
    const [salt, mac] = storedHash.split(':');
    if (!salt || !mac) return false;
    const calc = createHmac('sha256', pepper).update(`${apiKeyPlain}:${salt}`).digest('hex');
    try { return timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(calc, 'hex')); }
    catch { return false; }
  }

  getKid(apiKeyPlain: string): string | null {
    const m = apiKeyPlain.match(ApiKeyUtil.KEY_RE);
    return m?.groups?.kid ?? null;
  }

  mask(last4?: string | null) {
    return last4 ? `••••-••••-••••-${last4}` : '****-****-****-****';
  }

  private requirePepper(): string {
    const pepper = this.config.get<string>('API_KEY_PEPPER');
    if (!pepper) throw new Error('API_KEY_PEPPER is not configured');
    return pepper;
  }
}
