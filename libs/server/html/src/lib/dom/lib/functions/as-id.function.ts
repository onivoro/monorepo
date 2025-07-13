let idCounter = 0;

export function asId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}