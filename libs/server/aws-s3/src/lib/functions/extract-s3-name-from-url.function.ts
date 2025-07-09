import { extractS3KeyFromUrl } from './extract-s3-key-from-url.function';
import { extractS3NameFromKey } from './extract-s3-name-from-key.function';

export function extractS3NameFromUrl(url: string) {
  return extractS3NameFromKey(extractS3KeyFromUrl(url));
}
