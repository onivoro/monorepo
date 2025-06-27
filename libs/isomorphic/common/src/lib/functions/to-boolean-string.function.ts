export function toBooleanString(val?: boolean) {
  return (!!(val || false)).toString() as 'true' | 'false';
}
