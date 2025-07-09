export function extractS3NameFromKey(key: string) {
  return key.split('/').pop();
}
