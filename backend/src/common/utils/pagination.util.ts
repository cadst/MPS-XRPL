export const normalizePagination = (page?: number, limit?: number, max = 200) => {
  const p = Math.max(page ?? 1, 1)
  const l = Math.min(Math.max(limit ?? 10, 1), max)
  return { page: p, limit: l, offset: (p - 1) * l }
}
