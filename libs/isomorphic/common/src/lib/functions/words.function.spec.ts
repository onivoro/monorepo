import { words } from './words.function';

describe('words', () => {
  it('splits plain ascii words', () => {
    expect(words('fred, barney, & pebbles')).toEqual([
      'fred',
      'barney',
      'pebbles',
    ]);
  });

  it('uses the supplied pattern when given', () => {
    expect(words('fred, barney, & pebbles', /[^, ]+/g)).toEqual([
      'fred',
      'barney',
      '&',
      'pebbles',
    ]);
  });

  it('returns an empty array when the pattern does not match', () => {
    expect(words('abc', /\d+/g)).toEqual([]);
  });

  it('splits camelCase, acronyms and digits via unicode word matching', () => {
    expect(words('fooBarBaz')).toEqual(['foo', 'Bar', 'Baz']);
    expect(words('XMLHttpRequest')).toEqual(['XML', 'Http', 'Request']);
    expect(words('foo2bar')).toEqual(['foo', '2', 'bar']);
  });

  it('handles non-ascii letters', () => {
    expect(words('crème brûlée')).toEqual(['crème', 'brûlée']);
  });

  it('returns an empty array when there are no words', () => {
    expect(words('')).toEqual([]);
    expect(words('---')).toEqual([]);
    expect(words('-_-')).toEqual([]);
  });
});
