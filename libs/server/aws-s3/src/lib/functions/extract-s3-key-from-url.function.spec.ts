import { extractS3KeyFromUrl } from './extract-s3-key-from-url.function';
import { resolveUrl } from './resolve-url.function';

describe(extractS3KeyFromUrl.name, () => {
  it.each([
    ['https://bucket.s3.us-east-2.amazonaws.com/file.pdf', 'file.pdf'],
    [
      'https://bucket.s3.us-east-2.amazonaws.com/nested/dir/file.pdf',
      'nested/dir/file.pdf',
    ],
    ['s3://bucket/a/b.json', 'a/b.json'],
    ['https://bucket.s3.amazonaws.com/', ''],
    ['https://bucket.s3.amazonaws.com', ''],
    ['https://s3.us-east-2.amazonaws.com/my.bucket/a/b.pdf', 'a/b.pdf'],
    ['https://s3-us-west-2.amazonaws.com/my.bucket/a/b.pdf', 'a/b.pdf'],
    ['https://s3.amazonaws.com/my.bucket/a/b.pdf', 'a/b.pdf'],
    ['https://s3.dualstack.us-east-1.amazonaws.com/my.bucket/b.pdf', 'b.pdf'],
    ['https://s3.us-east-2.amazonaws.com/my.bucket', ''],
    [
      'https://bucket.s3.us-east-2.amazonaws.com/a/b.pdf?X-Amz-Signature=abc&X-Amz-Expires=60',
      'a/b.pdf',
    ],
    [
      'https://s3.us-east-2.amazonaws.com/my.bucket/a/b.pdf?X-Amz-Expires=60#frag',
      'a/b.pdf',
    ],
    ['https://bucket.s3.us-east-2.amazonaws.com/a/b.pdf#frag', 'a/b.pdf'],
    ['s3://bucket/a/b.json?versionId=1', 'a/b.json'],
  ])('extracts the key from %s', (url, expected) => {
    expect(extractS3KeyFromUrl(url)).toBe(expected);
  });

  it.each([['already/a/key.txt'], ['key.txt'], ['']])(
    'returns %j unchanged when it is not a URL',
    (value) => {
      expect(extractS3KeyFromUrl(value)).toBe(value);
    },
  );

  it.each([[undefined], [null]])('returns %j unchanged', (value) => {
    expect(extractS3KeyFromUrl(value as unknown as string)).toBe(value);
  });

  it.each([
    ['plain-bucket', 'a/b.pdf'],
    ['my.dotted.bucket', 'a/b.pdf'],
    ['my.dotted.bucket', 'nested/dir/with space.txt'],
    ['plain-bucket', 'file.pdf'],
  ])('round-trips resolveUrl for bucket %s and key %s', (Bucket, Key) => {
    expect(extractS3KeyFromUrl(resolveUrl('us-east-2', { Bucket, Key }))).toBe(
      Key,
    );
  });
});
