export function extractS3KeyFromUrl(url: string) {
  return url?.includes('//')
    ? url?.split('//')[1]?.split('/')?.slice(1)?.join('/')
    : url;
}
