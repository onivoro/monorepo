import { round } from './round.function';

describe('round', () => {
  it.each([
    [1.2345, 100, 1.23],
    [1.235, 1000, 1.235],
    [1.5, 1, 2],
    [2.4, 1, 2],
    [7.26, 2, 7.5],
    [7.24, 2, 7],
    [-1.26, 10, -1.3],
  ])('round(%p, %p) === %p', (value, factor, expected) => {
    expect(round(value, factor)).toBe(expected);
  });
});
