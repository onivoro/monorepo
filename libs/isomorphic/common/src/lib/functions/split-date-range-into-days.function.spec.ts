import { splitDateRangeIntoDays } from './split-date-range-into-days.function';
import { arrangeActAssert } from '../functions/arrange-act-assert.function';
describe('splitDateRangeIntoDays', () => {
  it.each([
    [{ from: '', to: '' }],
    [{ from: 'asdf', to: '2345' }],
    [{ from: '2024-01-01', to: '2024-01-01' }],
    [{ from: '2024-01-01', to: '2024-02-01' }],
    [{ from: '2025-01-01', to: '' }],
  ])(
    'given %j, returns an array of days',
    async (_) =>
      await arrangeActAssert({
        arrange: () => ({ subject: splitDateRangeIntoDays }),
        act: ({ subject }) => subject(_),
        assert: ({ result }) => {
          expect(result).toMatchSnapshot();
        },
      }),
  );
});
describe('splitDateRangeIntoDays explicit', () => {
  it('lists each UTC day inclusive of both ends', () => {
    expect(
      splitDateRangeIntoDays({ from: '2024-02-27', to: '2024-03-01' }),
    ).toEqual(['2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01']);
  });

  it('returns the single day when from equals to', () => {
    expect(
      splitDateRangeIntoDays({ from: '2024-01-01', to: '2024-01-01' }),
    ).toEqual(['2024-01-01']);
  });

  it('returns only the end day when from is after to', () => {
    expect(
      splitDateRangeIntoDays({ from: '2024-01-05', to: '2024-01-01' }),
    ).toEqual(['2024-01-01']);
  });

  it.each([
    [{ from: '', to: '2024-01-01' }],
    [{ from: '2024-01-01', to: 'nope' }],
    [{} as { from: string; to: string }],
  ])('returns [] for missing or non-ISO input %j', (input) => {
    expect(splitDateRangeIntoDays(input)).toEqual([]);
  });
});
