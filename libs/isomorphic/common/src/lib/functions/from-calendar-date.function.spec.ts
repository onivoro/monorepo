import { fromCalendarDate } from './from-calendar-date.function';

describe('fromCalendarDate', () => {
  describe('GIVEN input is partial or full ISO8601', () => {
    it.each(['2023-12-23'])('%j', (input) => {
      expect(fromCalendarDate(input)).toMatchSnapshot();
    });
  });
});
describe('fromCalendarDate (timezone independent)', () => {
  it.each([undefined, null, '', 'garbage'])('returns null for %p', (input) => {
    expect(fromCalendarDate(input)).toBeNull();
  });

  it('returns local midnight of the given calendar date', () => {
    const result = fromCalendarDate('2023-12-23') as Date;

    expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual(
      [2023, 11, 23],
    );
    expect([result.getHours(), result.getMinutes()]).toEqual([0, 0]);
  });
});
