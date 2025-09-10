export const normalizeSort = (
  sortBy?: string,
  order?: 'asc' | 'desc',
  allowList: string[] = [],
) => {
  const safeSortBy = allowList.includes(sortBy || '') ? (sortBy as string) : allowList[0]
  const safeOrder: 'asc' | 'desc' = order === 'desc' ? 'desc' : 'asc'
  return { sortBy: safeSortBy, order: safeOrder }
}
