import { extractS3NameFromKey } from './extract-s3-name-from-key.function';

describe(extractS3NameFromKey.name, () => {
  it.each([
    ['dir/sub/file.pdf', 'file.pdf'],
    ['file.pdf', 'file.pdf'],
    ['dir/', ''],
    ['', ''],
  ])('returns the last segment of %j', (key, expected) => {
    expect(extractS3NameFromKey(key)).toBe(expected);
  });
});
