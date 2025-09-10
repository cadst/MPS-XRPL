import { Injectable, Inject  } from '@nestjs/common';
import { db } from '../../db/client';
import { and, desc, eq, sql } from 'drizzle-orm';
import { companies, business_numbers, company_subscriptions } from '../../db/schema'; 

export type CompanyRow = typeof companies.$inferSelect;
export type CompanySubscriptionRow = typeof company_subscriptions.$inferSelect;

@Injectable()
export class CompaniesRepository {
  constructor(@Inject('DB') private readonly db: any) {}
  findDuplicate(email: string, name: string, bizno: string) {
    return db.query.companies.findFirst({
      where: (c, { sql }) =>
        sql`${c.email} = ${email} or ${c.name} = ${name} or ${c.business_number} = ${bizno}`,
      columns: { id: true },
    });
  }

  async existsBizno(bizno: string): Promise<boolean> {
    const row = await db.query.business_numbers.findFirst({
      where: (b, { sql }) => sql`regexp_replace(${b.number}, '\D', '', 'g') = ${bizno}`,
      columns: { id: true },
    });
    return !!row;
  }

  async insert(values: typeof companies.$inferInsert) {
    return db.insert(companies).values(values).returning();
  }
  async findLatestSubscription(companyId: number) {
    const [row] = await db
      .select()
      .from(company_subscriptions)
      .where(eq(company_subscriptions.company_id, companyId))
      .orderBy(desc(company_subscriptions.end_date))
      .limit(1);
    return row as CompanySubscriptionRow | undefined;
  }

  findById(id: number) {
    return db.query.companies.findFirst({
      where: (c, { sql }) => sql`${c.id} = ${id}`,  
    });
  }

  findByEmail(email: string) {
    return db.query.companies.findFirst({
      where: (c, { sql }) => sql`${c.email} = ${email}`,
    });
  }
  // api 재발급 
  async updateApiKeyByCompanyId(
    companyId: number | string,
    data: {
      api_key_hash: string;
      api_key_id?: string | null;
      api_key_last4?: string | null;
      api_key_version?: number | null;
    },
  ) {
    const id = typeof companyId === 'string' ? parseInt(companyId, 10) : companyId; // ← number로
    await this.db
      .update(companies)
      .set({
        api_key_hash: data.api_key_hash,
        ...(data.api_key_id      !== undefined ? { api_key_id: data.api_key_id } : {}),
        ...(data.api_key_last4   !== undefined ? { api_key_last4: data.api_key_last4 } : {}),
        ...(data.api_key_version !== undefined ? { api_key_version: data.api_key_version } : {}),
        api_key_rotated_at: sql`now()`,   
      })
      .where(eq(companies.id, id));      
  }

  // 스마트 계정 주소 업데이트
  async updateSmartAccountAddress(companyId: number, smartAccountAddress: string) {
    await this.db
      .update(companies)
      .set({
        smart_account_address: smartAccountAddress,
        updated_at: sql`now()`,
      })
      .where(eq(companies.id, companyId));
  }
}
