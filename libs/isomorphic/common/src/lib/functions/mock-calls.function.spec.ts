import { mockCalls } from './mock-calls.function';

describe('mockCalls', () => {
  it('keys the calls by label and invocation count', () => {
    const fn = jest.fn();
    fn(1, 2);
    fn('a');

    expect(mockCalls(fn, 'thing')).toEqual({
      'thing -->> 2 invocation(s)': [[1, 2], ['a']],
    });
  });

  it('uses a default label', () => {
    expect(mockCalls(jest.fn())).toEqual({
      'mock-calls -->> 0 invocation(s)': [],
    });
  });

  it.each([undefined, null, {}, () => undefined])(
    'tolerates non-mocks (%p)',
    (notAMock) => {
      expect(mockCalls(notAMock, 'x')).toEqual({
        'x -->> 0 invocation(s)': [],
      });
    },
  );
});
