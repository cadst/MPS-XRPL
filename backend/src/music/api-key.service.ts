import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { companies } from '../db/schema';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
    constructor(
        @Inject('DB') private db: NodePgDatabase<any>
    ) { }

    /**
     * API 키 검증
     * @param apiKey 클라이언트에서 전송된 API 키
     * @returns 검증된 회사 정보 또는 null
     */
    async validateApiKey(apiKey: string): Promise<any | null> {
        if (!apiKey) return null;

        const apiKeyHash = this.hashApiKey(apiKey);
        console.log('해시된 API Key:', apiKeyHash);
        const result = await this.db
            .select()
            .from(companies)
            .where(eq(companies.api_key_hash, apiKeyHash));

        // console.log(result, 'api 키 검증 결과123')
        if (result.length === 0) return null;
        return result[0];
    }

    /**
    * API 키 해시화
    * @param apiKey 원본 API 키
    * @returns 해시된 API 키
    */
    private hashApiKey(apiKey: string): string {
        return crypto.createHash('sha256').update(apiKey).digest('hex');
    }

    // api 키 생성(회원가입), 수정(재발급) 기능 추가 
}