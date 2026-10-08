import { addOffset } from './add-offset.function';

describe('addOffset', () => {
  describe('GIVEN input is partial or full ISO8601', () => {
    it.each(['2023-12-23', '2023-12-23T00:00:00.000'])('%j', (input) => {
      expect(addOffset(input)).toMatchSnapshot();
    });
  });
});
describe('addOffset (timezone independent)', () => {
  it.each([undefined, null, '', 'not a date'])(
    'returns undefined for %p',
    (input) => {
      expect(addOffset(input)).toBeUndefined();
    },
  );

  it('shifts a Date forward by its timezone offset', () => {
    const input = new Date('2023-12-23T12:00:00.000Z');
    expect(addOffset(input)?.getTime()).toBe(
      input.getTime() + input.getTimezoneOffset() * 60 * 1000,
    );
  });

  it('turns a UTC calendar date into local midnight of the same calendar date', () => {
    const result = addOffset('2023-12-23') as Date;

    expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual(
      [2023, 11, 23],
    );
    expect(result.getHours()).toBe(0);
  });
});
