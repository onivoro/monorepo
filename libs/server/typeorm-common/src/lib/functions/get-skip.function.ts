export function getSkip(pagingKey: number | string, pageSize: number) {
  return pagingKey ? Number(pagingKey) * pageSize : 0;
}
