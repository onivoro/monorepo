export function tryJsonParse<T>(parseable: string | null | undefined): T | null {
  if (typeof parseable === 'undefined') {
    return null;
  }

  try {
    return JSON.parse(parseable as any) as T;
  } catch (_e) {
    return null;
  }
}
