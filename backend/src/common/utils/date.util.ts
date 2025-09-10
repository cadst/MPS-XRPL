import { sql } from 'drizzle-orm'

export const isValidYearMonth = (s?: string) => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s)

export const getDefaultYearMonthKST = () => {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  const y = kst.getUTCFullYear()
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export const resolveYearMonthKST = (ym?: string) =>
  isValidYearMonth(ym) ? ym! : getDefaultYearMonthKST()

export const getPrevYearMonthKST = (ym?: string) => {
  const base = resolveYearMonthKST(ym)
  const [y, m] = base.split('-').map(Number)
  const prev = new Date(Date.UTC(y, m - 2, 1))
  const py = prev.getUTCFullYear()
  const pm = String(prev.getUTCMonth() + 1).padStart(2, '0')
  return `${py}-${pm}`
}

export const resolveYMToYearMonth = (ym?: string) => {
  const r = resolveYearMonthKST(ym)
  const [year, month] = r.split('-').map(Number)
  return { year, month }
}

export const isCurrentYM = (ym: string) => {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth() + 1
  const [yy, mm] = ym.split('-').map(Number)
  return y === yy && m === mm
}

export const getMonthStartEndSqlKST = (y: number, m: number) => {
  return {
    start: `make_timestamptz(${y}, ${m}, 1, 0, 0, 0, 'Asia/Seoul')`,
    end: `(make_timestamptz(${y}, ${m}, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second'`,
  }
}

export const getMonthRangeSqlKST = (y: number, m: number) => {
  return {
    start: sql`make_timestamptz(${y}, ${m}, 1, 0, 0, 0, 'Asia/Seoul')`,
    end: sql`(make_timestamptz(${y}, ${m}, 1, 0, 0, 0, 'Asia/Seoul') + interval '1 month') - interval '1 second'`,
  }
}

export const buildMonthRangeCTE = (y: number, m: number) => {
  const { start, end } = getMonthRangeSqlKST(y, m)
  return sql`
    WITH month_range AS (
      SELECT ${start} AS month_start, ${end} AS month_end
    )
  `
}

export const getDayRangeSqlKST = (y: number, m: number, d: number) => {
  return {
    start: sql`make_timestamptz(${y}, ${m}, ${d}, 0, 0, 0, 'Asia/Seoul')`,
    end: sql`(make_timestamptz(${y}, ${m}, ${d}, 0, 0, 0, 'Asia/Seoul') + interval '1 day')`,
  }
}

export const buildDayRangeCTE = (y: number, m: number, d: number) => {
  const { start, end } = getDayRangeSqlKST(y, m, d)
  return sql`
    WITH day_range AS (
      SELECT ${start} AS day_start, ${end} AS day_end
    )
  `
}