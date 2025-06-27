import { upperFirst } from './upper-first.function';

describe('upperFirst', () => {
  it.each([
    'asdf',
    'XCVB'
  ])('GIVEN %j, does what u expect', (input) => {
    expect(upperFirst(input)).toMatchSnapshot();
  });

  it.each([
    null, undefined, 0, false
  ])('GIVEN falsey input %j, does what u expect', (input) => {
    expect(upperFirst(input)).toMatchSnapshot();
  });
});