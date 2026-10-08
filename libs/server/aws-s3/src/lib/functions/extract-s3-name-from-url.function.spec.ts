import { extractS3NameFromUrl } from './extract-s3-name-from-url.function';

describe(extractS3NameFromUrl.name, () => {
  it.each([
    ['https://bucket.s3.us-east-2.amazonaws.com/a/b/report.csv', 'report.csv'],
    ['https://bucket.s3.us-east-2.amazonaws.com/report.csv', 'report.csv'],
    ['a/b/report.csv', 'report.csv'],
    ['report.csv', 'report.csv'],
    ['https://s3.us-east-2.amazonaws.com/my.bucket/report.csv', 'report.csv'],
    [
      'https://bucket.s3.us-east-2.amazonaws.com/a/report.csv?X-Amz-Expires=60',
      'report.csv',
    ],
  ])('returns the file name from %s', (url, expected) => {
    expect(extractS3NameFromUrl(url)).toBe(expected);
  });
});
