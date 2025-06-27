export function fromCsvString(value?: string) {
  return value ? value.split(',').map((v) => v.trim()) : [];
}
