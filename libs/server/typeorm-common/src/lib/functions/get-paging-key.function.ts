export function getPagingKey(pageSize: number, skip: number, total: number): number | undefined {
  return skip + pageSize < total ? skip / pageSize + 1 : undefined;
}
