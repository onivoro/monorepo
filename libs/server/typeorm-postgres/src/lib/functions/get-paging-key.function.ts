export function getPagingKey(pageSize: number, skip: number, total: number) {
  return pageSize * skip < total ? skip + 1 : undefined;
}
