export function parseBool(asc: string | boolean | null | undefined) {
  return asc ? asc === true || asc === 'true' : false;
}
