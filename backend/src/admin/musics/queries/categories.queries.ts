import { sql } from 'drizzle-orm'
import { music_categories } from '../../../db/schema/music_categories'

export function buildCategoryExistsQuery(name: string) {
  return sql`
    SELECT id FROM ${music_categories}
    WHERE LOWER(${music_categories.name}) = LOWER(${name})
    LIMIT 1
  `
}
