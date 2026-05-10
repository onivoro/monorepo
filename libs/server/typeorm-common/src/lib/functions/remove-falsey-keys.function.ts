export function removeFalseyKeys<T extends Record<any, any>>(obj: T) {
  return Object.entries(obj)
    .filter(([k, v]) => typeof v !== 'undefined')
    .reduce((acc, [k, v]) => {
      (acc as any)[k] = v;
      return acc;
    }, {}) as T;
}
