// src/lib/api/companies.ts
import { api, apiForm, qs } from './core/http';

export type VerifyResp = {
  ok: boolean;
  mode: string; // DB_ONLY | HYBRID | NTS_ONLY | CHECKSUM ...
  source?: 'LOCAL' | 'NTS' | 'CHECKSUM' | 'CLIENT';
  business_number: string;
  reason?: string | null;
  tax_type?: string | null;
  error?: string;
};

export type RegisterDto = {
  name: string;
  business_number: string; // 숫자 10자리 권장(클라에서 정규화)
  email: string;
  password: string;
  phone?: string;
  ceo_name?: string;
  profile_image_url?: string; // 파일 있으면 서버가 덮어씀
  homepage_url?: string;
};

export type RegisterResponse = {
  id: number;
  name: string;
  email: string;
  grade: string;
  created_at: string;
  api_key?: string;       // 평문 키(1회 노출)
  api_key_hint?: string;  // UI 힌트
};

/** 사업자번호 검증 */
export async function verifyBizno(bNo: string, opts?: { skipNts?: boolean }) {
  const clean = (bNo || '').replace(/\D/g, '');
  const query = qs({ bNo: clean, ...(opts?.skipNts ? { skipNts: 1 } : {}) });
  return api(`/companies/business_numbers?${query}`) as Promise<VerifyResp>;
}

/** 회원가입 (파일 있으면 multipart, 없으면 JSON) */
export async function registerCompany(dto: RegisterDto, opts?: { skipNts?: boolean; profileFile?: File | null }) {
  const path = `/companies/register${opts?.skipNts ? '?skipNts=1' : ''}`;

  if (opts?.profileFile) {
    const fd = new FormData();
    // 서버 FileInterceptor 필드명과 일치
    fd.append('profile_image', opts.profileFile);
    Object.entries(dto).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, String(v)); });
    return apiForm(path, fd) as Promise<RegisterResponse>;
  }
  return api(path, { method: 'POST', body: JSON.stringify(dto) }) as Promise<RegisterResponse>;
}

export async function rotateApiKey(companyId: number) {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
  const res = await fetch(`${base}/companies/${companyId}/regenerate-api-key`, { method: 'POST', credentials: 'include' });
  console.log("호출번호", res);
  if (!res.ok) throw new Error('API key rotate failed');
  return res.json() as Promise<{ api_key: string; last4: string }>;
}
