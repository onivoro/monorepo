export function convertObjectToLiteral(
  literalFn: (k: string, v: any) => string,
  delimiter: string,
  keyValuePairs: Record<string, any>
) {
  return Object.entries(keyValuePairs)
    .filter(([, v]) => !!v || v === 0 || v === false)
    .map(([k, v]) => literalFn(k, v?.toString?.()))
    .join(delimiter);
}
