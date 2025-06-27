export function removeFalseyKeys<T>(obj: T) {
  return Object.entries(obj as any)
    .filter(([k, v]) => typeof v !== 'undefined')
    .reduce((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {} as any) as T;
}
