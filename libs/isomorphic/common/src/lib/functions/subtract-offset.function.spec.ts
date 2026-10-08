import { subtractOffset } from './subtract-offset.function';

describe('subtractOffset', () => {
  describe('GIVEN input is partial or full ISO8601', () => {
    it.each(['2023-12-23', '2023-12-23T00:00:00.000'])('%j', (input) => {
      expect(subtractOffset(input)).toMatchSnapshot();
    });
  });
});
describe('subtractOffset (timezone independent)', () => {
  it.each([undefined, null, '', 'not a date'])(
    'returns undefined for %p',
    (input) => {
      expect(subtractOffset(input)).toBeUndefined();
    },
  );

  it('shifts a Date back by its timezone offset', () => {
    const input = new Date('2023-12-23T12:00:00.000Z');
    expect(subtractOffset(input)?.getTime()).toBe(
      input.getTime() - input.getTimezoneOffset() * 60 * 1000,
    );
  });

  it('expresses local wall-clock time as UTC', () => {
    const local = new Date(2023, 11, 23, 15, 30);
    expect(subtractOffset(local)?.toISOString()).toBe(
      '2023-12-23T15:30:00.000Z',
    );
  });
});
