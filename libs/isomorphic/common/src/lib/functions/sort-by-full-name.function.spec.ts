import { sortByFullName } from './sort-by-full-name.function';

describe('sortByFullName', () => {
  const ada = { firstName: 'Ada', lastName: 'Lovelace' };
  const alan = { firstName: 'Alan', lastName: 'Turing' };

  it('compares "first last" names', () => {
    expect(sortByFullName(ada, alan)).toBeLessThan(0);
    expect(sortByFullName(alan, ada)).toBeGreaterThan(0);
    expect(sortByFullName(ada, { ...ada })).toBe(0);
  });

  it('sorts an array', () => {
    expect([alan, ada].sort(sortByFullName)).toEqual([ada, alan]);
  });
});
