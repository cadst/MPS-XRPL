import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CompaniesRepository } from './companies.repository';
import { OdcloudClient } from './odcloud.client';
import { CreateCompanyDto } from './dto/create-companie.dto';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import { ApiKeyUtil } from '../common/utils/api-key.util';
import { BlockchainService } from './blockchain.service';
// 🔹 레포 타입과의 의존성 최소화를 위해 로컬 최소 타입 정의
type MinimalSubscriptionRow = {
  start_date: Date | string;
  end_date: Date | string;
  tier?: string | null;
};

type VerifyResp = {
  ok: boolean;
  mode: string; // DB_ONLY | HYBRID | NTS_ONLY | CHECKSUM
  source: 'LOCAL' | 'NTS' | 'CHECKSUM' | 'CLIENT';
  business_number: string;
  reason?: string | null;   // CHECKSUM_FAIL / NOT_IN_LOCAL / CLOSED / NTS_NOT_REGISTERED / NTS_ERROR / NTS_UNAVAILABLE ...
  tax_type?: string | null;
  error?: string;
};

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);
  
  constructor(
    private readonly repo: CompaniesRepository,
    private readonly odcloud: OdcloudClient,
    private readonly config: ConfigService,
    private readonly apiKeyUtil: ApiKeyUtil,
    private readonly blockchainService: BlockchainService,
  ) {}

  private normalizeBizno(s: string) {
    const n = (s ?? '').replace(/[^0-9]/g, '').trim();
    return n.length === 10 ? n : ''; // 10자리 강제
  }

  private isBiznoChecksumOk(s10: string) {
    if (!/^\d{10}$/.test(s10)) return false;
    const w = [1,3,7,1,3,7,1,3,5], d = s10.split('').map(Number);
    let sum = 0; for (let i=0;i<9;i++) sum += d[i]*w[i];
    sum += Math.floor((d[8]*5)/10);
    return ((10 - (sum % 10)) % 10) === d[9];
  }

  private async verifyWithNts(bizno: string): Promise<{ ok: boolean; closed?: boolean; tax_type?: string | null; reason?: string }> {
    try {
      const resp: any = await Promise.race([
        this.odcloud.status(bizno), // 내부에서 POST { b_no: [bizno] }
        new Promise((_, rej) => setTimeout(() => rej(new Error('NTS timeout')), 7000)),
      ]);

      const row = resp?.data?.[0];
      const matchCnt = Number(resp?.match_cnt ?? (Array.isArray(resp?.data) ? resp.data.length : 0));
      if (!row || matchCnt === 0) {
        return { ok: false, reason: 'NTS_NOT_REGISTERED' };
      }

      // b_stt_cd: '01'=계속, '03'=폐업
      const closed = String(row.b_stt_cd) === '03' || String(row.b_stt || '').includes('폐업');
      if (closed) {
        return { ok: false, closed: true, tax_type: row.tax_type ?? null, reason: 'CLOSED' };
      }
      return { ok: true, tax_type: row.tax_type ?? null };
    } catch (e: any) {
      throw e;
    }
  }

  // HYBRID 검증 + 비번 해시 + API 키 발급(해시 저장) + 평문 키 1회 노출
  async create(dto: CreateCompanyDto, skipNts = false) {
    const bizno = this.normalizeBizno(dto.business_number);
    if (!this.isBiznoChecksumOk(bizno)) {
      throw new BadRequestException('사업자번호 형식 오류');
    }

    const dup = await this.repo.findDuplicate(dto.email, dto.name, bizno);
    if (dup) throw new ConflictException('이미 가입된 이메일/상호/사업자번호가 있습니다.');

    // HYBRID / NTS_ONLY / DB_ONLY
    const mode = (this.config.get<string>('BIZNO_VERIFIER') ?? 'HYBRID').trim().toUpperCase();

    let needNts = false;
    if (!skipNts) {
      if (mode === 'NTS_ONLY') {
        needNts = true;
      } else if (mode === 'HYBRID') {
        const existsLocal = await this.repo.existsBizno(bizno); // DB는 숫자 10자리로 저장/비교
        needNts = !existsLocal;
      }
    }

    if (needNts) {
      try {
        const nts = await this.verifyWithNts(bizno);
        if (!nts.ok) {
          if (nts.reason === 'CLOSED') throw new BadRequestException('폐업 사업자');
          throw new BadRequestException('유효하지 않은 사업자번호');
        }
      } catch (e: any) {
        if (this.config.get<string>('STRICT_NTS') === '1') {
          throw new BadRequestException('NTS_ERROR: ' + (e?.message ?? String(e)));
        }
        this.logger.warn(`NTS_ERROR(create): ${e?.message ?? e}`);
        // 소프트 통과
      }
    }

    // 1) 비밀번호 해시
    const password_hash = await bcrypt.hash(dto.password, 10);

    // 2) API 키 생성(평문) + 해시화
    const rawApiKey = randomBytes(32).toString('hex'); // 필요 시 prefix 붙이려면 여기서 처리
    const api_key_hash = createHash('sha256').update(rawApiKey).digest('hex');

    // 3) 스마트 계정 생성
    let smartAccountInfo: {
      eoaAddress: string;
      smartAccountAddress: string;
      transactionHash?: string;
    } | null = null;

    try {
      this.logger.log(`스마트 계정 생성 시작 - 이메일: ${dto.email}, 사업자번호: ${bizno}`);
      smartAccountInfo = await this.blockchainService.createSmartAccount(dto.email, bizno);
      this.logger.log(`스마트 계정 생성 완료 - EOA: ${smartAccountInfo.eoaAddress}, SmartAccount: ${smartAccountInfo.smartAccountAddress}`);
    } catch (error) {
      this.logger.error(`스마트 계정 생성 실패: ${error.message}`);
      // 스마트 계정 생성 실패 시에도 회원가입은 진행 (소프트 실패)
      // 실제 운영 환경에서는 정책에 따라 하드 실패로 처리할 수도 있음
    }

    // 4) INSERT 시 해시와 블록체인 정보 저장
    const [row] = await this.repo.insert({
      name: dto.name,
      business_number: bizno,
      email: dto.email,
      password_hash,
      phone: dto.phone ?? null,
      ceo_name: dto.ceo_name ?? null,
      profile_image_url: dto.profile_image_url ?? null,
      homepage_url: dto.homepage_url ?? null,
      api_key_hash,
      // 스마트 계정 주소만 저장 (EOA 주소는 필요 시 역산 가능)
      smart_account_address: smartAccountInfo?.smartAccountAddress ?? null,
    });

    // 5) 응답에서 평문 1회 노출 + 스마트 계정 정보 포함
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      grade: row.grade,
      created_at: row.created_at,
      api_key: rawApiKey,
      api_key_hint: `${rawApiKey.slice(0, 4)}...${rawApiKey.slice(-4)}`,
      blockchain: smartAccountInfo ? {
        eoaAddress: smartAccountInfo.eoaAddress,
        smartAccountAddress: smartAccountInfo.smartAccountAddress,
        transactionHash: smartAccountInfo.transactionHash,
      } : null,
    };
  }

  /* -------------------- 구독 상태 파생 -------------------- */
  private deriveSubscriptionStatus(
    grade: 'free' | 'standard' | 'business',
    sub?: MinimalSubscriptionRow | null,
  ): 'free' | 'active' | 'expired' | 'scheduled' {
    if (grade === 'free') return 'free';
    if (!sub) return 'expired';

    const now = new Date();
    const start = new Date(sub.start_date);
    const end = new Date(sub.end_date);

    if (start <= now && now <= end) return 'active';
    if (now < start) return 'scheduled';
    return 'expired';
  }

  /* -------------------- 로그인 검증 -------------------- */
  async validateByEmailPassword(email: string, password: string) {
    const normEmail = String(email).trim().toLowerCase();
    const row = await this.repo.findByEmail(normEmail);
    if (!row) return null;

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return null;

    // 최신 구독 한 건 읽어서 상태 계산
    const latestSub = await this.repo.findLatestSubscription(row.id); // 반환 타입은 any여도 OK
    const subscriptionStatus = this.deriveSubscriptionStatus(row.grade as any, latestSub as MinimalSubscriptionRow | null);

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      grade: row.grade,
      profile_image_url: row.profile_image_url ?? null,
      subscriptionStatus,                    // 'free' | 'active' | 'expired' | 'scheduled'
      subscriptionTier: (latestSub as any)?.tier ?? null,
      subscriptionEndsAt: (latestSub as any)?.end_date ?? null,
    };
  }

  async getProfileById(id: number) {
    const row = await this.repo.findById(id);
    if (!row) return null;
    return row;
  }

  /* -------------------- 버튼용: 번호 검증 -------------------- */
  // OR 정책: LOCAL || NTS
  async verifyBizno(biznoInput: string, skipNts = false): Promise<VerifyResp> {
    const bizno = this.normalizeBizno(biznoInput ?? '');
    if (!bizno) {
      return { ok: false, mode: 'CHECKSUM', source: 'CHECKSUM', business_number: bizno, reason: 'FORMAT_ERROR' };
    }
    const mode = (this.config.get<string>('BIZNO_VERIFIER') ?? 'HYBRID').trim().toUpperCase();

    // 1) LOCAL
    let localOk = false;
    try {
      localOk = await this.repo.existsBizno(bizno); // 숫자 10자리 기준
    } catch (e: any) {
      this.logger.warn(`LOCAL_ERROR(verify): ${e?.message ?? e}`);
    }

    // 2) NTS (DB_ONLY이거나 skipNts면 실행 안 함)
    let ntsOk = false;
    let ntsReason: string | null = null;
    let taxType: string | null = null;
    let ntsErrored = false;

    if (mode !== 'DB_ONLY' && !skipNts) {
      try {
        const nts = await this.verifyWithNts(bizno);
        ntsOk = !!nts.ok;
        taxType = nts.tax_type ?? null;
        ntsReason = nts.ok ? null : (nts.reason ?? 'NTS_NOT_REGISTERED');
      } catch (e: any) {
        ntsErrored = true;
        ntsReason = 'NTS_ERROR';
        this.logger.warn(`NTS_ERROR(verify): ${e?.message ?? e}`);
      }
    } else {
      ntsReason = mode === 'DB_ONLY' ? 'NTS_DISABLED' : 'NTS_SKIPPED';
    }

    // 3) 최종 OR (+ 소프트 실패 정책)
    let ok = localOk || ntsOk;
    let reason: string | null = null;
    let source: VerifyResp['source'] = 'CLIENT';

    if (ok) {
      if (localOk) { source = 'LOCAL'; reason = null; }
      else { source = 'NTS'; reason = null; }
    } else {
      if (!localOk && ntsErrored && this.config.get<string>('STRICT_NTS') !== '1') {
        ok = true;
        source = 'CHECKSUM';
        reason = 'NTS_UNAVAILABLE';
      } else {
        source = 'NTS';
        reason = ntsReason || (!localOk ? 'NOT_IN_LOCAL' : 'UNKNOWN');
      }
    }

    return { ok, mode, source, business_number: bizno, reason, tax_type: taxType };
  }
  
  async regenerateApiKey(companyId: number | string) {
  const id = typeof companyId === 'string' ? parseInt(companyId, 10) : companyId; 
  const { key, last4, kid, version, hash } = this.apiKeyUtil.generate('live');

  await this.repo.updateApiKeyByCompanyId(id, {
    api_key_hash: hash,
    api_key_id: kid,          
    api_key_last4: last4,
    api_key_version: version,
  });
  
  return { api_key: key, last4 };
  }

  /**
   * 스마트 계정 생성 또는 조회
   */
  async createOrGetSmartAccount(companyId: number) {
    const company = await this.repo.findById(companyId);
    if (!company) {
      throw new BadRequestException('회사 정보를 찾을 수 없습니다.');
    }

    // 이미 스마트 계정이 있으면 반환
    if (company.smart_account_address) {
      return {
        eoaAddress: null, // EOA 주소는 별도 저장하지 않음
        smartAccountAddress: company.smart_account_address,
        isExisting: true,
      };
    }

    try {
      // 새 스마트 계정 생성
      const smartAccountInfo = await this.blockchainService.createSmartAccount(
        company.email,
        company.business_number
      );

      // DB 업데이트
      await this.repo.updateSmartAccountAddress(companyId, smartAccountInfo.smartAccountAddress);

      return {
        eoaAddress: smartAccountInfo.eoaAddress,
        smartAccountAddress: smartAccountInfo.smartAccountAddress,
        transactionHash: smartAccountInfo.transactionHash,
        isExisting: false,
      };
    } catch (error) {
      this.logger.error(`스마트 계정 생성 실패 (Company ID: ${companyId}): ${error.message}`);
      throw new BadRequestException(`스마트 계정 생성에 실패했습니다: ${error.message}`);
    }
  }
}
