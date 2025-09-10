// apps/backend/src/scripts/seedCategories.ts
import 'dotenv/config';
import { Client } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

// 스키마 경로는 프로젝트에 맞춰 주세요.
// 예: src/db/schema.ts 에서 export const music_categories = ...
import * as schema from '../db/schema';
import { music_categories } from '../db/schema';

type NewCategory = typeof music_categories.$inferInsert;

const CATEGORIES: NewCategory[] = [
  { name: 'Pop' }, { name: '발라드' }, { name: '댄스' }, { name: '힙합' }, { name: 'R&B' },
  { name: '락' }, { name: '클래식' }, { name: '재즈' }, { name: '트로트' }, { name: 'OST' },
  { name: '인디' }, { name: '포크' }, { name: '뉴에이지' }, { name: 'EDM' }, { name: '랩' },
];

async function main() {
  const { DATABASE_URL } = process.env as { DATABASE_URL?: string };
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const db: NodePgDatabase<typeof schema> = drizzle(client, { schema });

  // UNIQUE(name) 기준 중복 무시
  await db.insert(music_categories)
    .values(CATEGORIES)
    .onConflictDoNothing({ target: music_categories.name });

  // 확인용 카운트
  const result = await client.query<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM music_categories;');
  console.log(`✅ music_categories seeded. current rows: ${result.rows[0].cnt}`);

  await client.end();
}

main().catch((err) => {
  console.error('❌ seed failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
