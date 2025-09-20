import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CompaniesRepository } from './companies.repository';
import { OdcloudClient } from './odcloud.client';
import { CreateCompanyDto } from './dto/create-companie.dto';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import { ApiKeyUtil } from '../common/utils/api-key.util';
import { BlockchainService } from './blockchain.service';
import { XrplService } from '../xrpl/xrpl.service';
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
  reason?: string | null; // CHECKSUM_FAIL / NOT_IN_LOCAL / CLOSED / NTS_NOT_REGISTERED / NTS_ERROR / NTS_UNAVAILABLE ...
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
    private readonly xrpl: XrplService,
  ) {}

  private normalizeBizno(s: string) {
    const n = (s ?? '').replace(/[^0-9]/g, '').trim();
    return n; // 길이 제한 제거
  }

  private isBiznoChecksumOk(_s10: string) {
    return true; // 검증 비활성화
  }

  private async verifyWithNts(_bizno: string) {
    return { ok: true as const, tax_type: null as string | null }; // 외부 검증 비활성화
  }

  // HYBRID 검증 + 비번 해시 + API 키 발급(해시 저장) + 평문 키 1회 노출
  async create(dto: CreateCompanyDto, _skipNts = false) {
    // 사업자번호 검증·중복체크 제거
    const bizno = this.normalizeBizno(dto.business_number);

    const dup = await this.repo.findDuplicateLoose(dto.email, dto.name);
    if (dup) throw new ConflictException('이미 가입된 이메일/상호가 있습니다.');

    // 비밀번호 해시
    const password_hash = await bcrypt.hash(dto.password, 10);

    // API 키 생성(평문)+해시
    const rawApiKey = randomBytes(32).toString('hex');
    const api_key_hash = createHash('sha256').update(rawApiKey).digest('hex');

    // XRPL 지갑 생성(소프트 실패)
    let xrplAddress: string | null = null;
    let xrplSeed: string | null = null;
    try {
      const w = await this.xrpl.generateWallet();
      xrplAddress = w.address;
      xrplSeed = w.seed;
      await this.xrpl.fundTestnetWalletIfPossible(w.address);
    } catch (e: any) {
      this.logger.error(`XRPL 지갑 생성 실패: ${e?.message ?? e}`);
    }

    // 스마트 계정 생성(소프트 실패)
    let smartAccountInfo: {
      eoaAddress: string;
      smartAccountAddress: string;
      transactionHash?: string;
    } | null = null;
    try {
      smartAccountInfo = await this.blockchainService.createSmartAccount(
        dto.email,
        bizno,
      );
    } catch (error) {
      this.logger.error(`스마트 계정 생성 실패: ${error.message}`);
    }

    const [row] = await this.repo.insert({
      name: dto.name,
      business_number: bizno || dto.business_number || '',
      email: dto.email,
      password_hash,
      phone: dto.phone ?? null,
      ceo_name: dto.ceo_name ?? null,
      profile_image_url: dto.profile_image_url ?? null,
      homepage_url: dto.homepage_url ?? null,
      api_key_hash,
      smart_account_address: smartAccountInfo?.smartAccountAddress ?? null,
      xrpl_address: xrplAddress ?? null,
    });

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      grade: row.grade,
      created_at: row.created_at,
      api_key: rawApiKey,
      api_key_hint: `${rawApiKey.slice(0, 4)}...${rawApiKey.slice(-4)}`,
      blockchain: smartAccountInfo
        ? {
            eoaAddress: smartAccountInfo.eoaAddress,
            smartAccountAddress: smartAccountInfo.smartAccountAddress,
            transactionHash: smartAccountInfo.transactionHash,
          }
        : null,
      xrpl: xrplAddress ? { address: xrplAddress, seed: xrplSeed } : null,
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
    const subscriptionStatus = this.deriveSubscriptionStatus(
      row.grade as any,
      latestSub as MinimalSubscriptionRow | null,
    );

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      grade: row.grade,
      profile_image_url: row.profile_image_url ?? null,
      subscriptionStatus, // 'free' | 'active' | 'expired' | 'scheduled'
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
      return {
        ok: true,
        mode: 'DB_ONLY',
        source: 'CLIENT',
        business_number: '',
        reason: null,
        tax_type: null,
      } as any;
    }

    // 검증 비활성화 버전: 항상 통과
    return {
      ok: true,
      mode: 'DB_ONLY',
      source: 'CLIENT',
      business_number: bizno,
      reason: null,
      tax_type: null,
    } as any;
  }

  async regenerateApiKey(companyId: number | string) {
    const id =
      typeof companyId === 'string' ? parseInt(companyId, 10) : companyId;
    // 임시 복구: 레거시 방식 (random hex + sha256 고정 해시)
    const rawApiKey = randomBytes(32).toString('hex');
    const api_key_hash = createHash('sha256').update(rawApiKey).digest('hex');

    await this.repo.updateApiKeyByCompanyId(id, {
      api_key_hash,
      // ApiKeyUtil 기반 추가 메타 컬럼은 임시복구 경로에서는 미사용
      api_key_id: undefined,
      api_key_last4: undefined,
      api_key_version: undefined,
    });

    return { api_key: rawApiKey, last4: rawApiKey.slice(-4) };
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
        company.business_number,
      );

      // DB 업데이트
      await this.repo.updateSmartAccountAddress(
        companyId,
        smartAccountInfo.smartAccountAddress,
      );

      return {
        eoaAddress: smartAccountInfo.eoaAddress,
        smartAccountAddress: smartAccountInfo.smartAccountAddress,
        transactionHash: smartAccountInfo.transactionHash,
        isExisting: false,
      };
    } catch (error) {
      this.logger.error(
        `스마트 계정 생성 실패 (Company ID: ${companyId}): ${error.message}`,
      );
      throw new BadRequestException(
        `스마트 계정 생성에 실패했습니다: ${error.message}`,
      );
    }
  }
}
