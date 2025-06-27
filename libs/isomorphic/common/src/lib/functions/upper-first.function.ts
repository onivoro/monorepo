export function upperFirst(string: string) {
  if (!string) {
    return string;
  }

  return string
    .split('')
    .map((curr: string, i: number) => curr[!i ? 'toUpperCase' : 'toLowerCase']())
    .join('');
}
