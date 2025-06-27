export function tryJsonStringify<T>(object: T | null | undefined, fmtr?: any, spaces?: number): string | null {
  if (typeof object === 'undefined') {
    return null;
  }

  try {
    return JSON.stringify(object, fmtr, spaces);
  } catch (_e) {
    return null;
  }
}
