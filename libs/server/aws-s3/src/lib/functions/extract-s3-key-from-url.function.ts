// Path-style S3 hosts (`s3.amazonaws.com`, `s3.<region>.amazonaws.com`, `s3-<region>.amazonaws.com`,
// `s3.dualstack.<region>.amazonaws.com`) put the bucket in the first path segment.
const PATH_STYLE_HOST =
  /^s3(?:[.-](?:dualstack\.)?[a-z0-9-]+)?\.amazonaws\.com(?:\.cn)?$/i;

export function extractS3KeyFromUrl(url: string) {
  if (!url?.includes('//')) {
    return url;
  }

  const [hostAndPath] = url.split('//')[1].split(/[?#]/);
  const [host, ...segments] = hostAndPath.split('/');

  return (PATH_STYLE_HOST.test(host) ? segments.slice(1) : segments).join('/');
}
