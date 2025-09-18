import { sql } from 'drizzle-orm'

export function buildMonthRangeCTE(year: number, month: number) {
  return sql`
    WITH month_range AS (
      SELECT
        make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') AS month_start,
        (make_timestamptz(${year}, ${month}, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second' AS month_end
    )
  `
}
