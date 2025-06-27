export function toCsvString(val?: string[]) {
  return (val || []).join(',');
}
