import { tryParseDate } from './try-parse-date.function';

describe('tryParseDate', () => {
  describe('GIVEN input is partial or full ISO8601', () => {
    it.each(['2023-12-23', '2023-12-23T00:00:00.000'])('%j', (input) => {
      expect(tryParseDate(input)).toMatchSnapshot();
    });
  });
});
describe('tryParseDate branches', () => {
  it.each([undefined, null, ''])(
    'returns undefined for empty input %p',
    (input) => {
      expect(tryParseDate(input)).toBeUndefined();
    },
  );

  it('returns the same Date instance when given a Date', () => {
    const date = new Date(0);
    expect(tryParseDate(date)).toBe(date);
  });

  it('parses a fully qualified ISO string', () => {
    expect(tryParseDate('2023-12-23T01:02:03.000Z')?.toISOString()).toBe(
      '2023-12-23T01:02:03.000Z',
    );
  });

  it('returns undefined for an unparseable string', () => {
    expect(tryParseDate('not a date')).toBeUndefined();
  });
});
