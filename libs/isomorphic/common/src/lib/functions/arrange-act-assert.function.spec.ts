import { arrangeActAssert } from './arrange-act-assert.function';

describe('arrangeActAssert', () => {
  it('passes arrange output to act, and arrange output plus result to assert', async () => {
    const act = jest.fn(({ a }: { a: number }) => a * 2);
    const assert = jest.fn(() => 'asserted');

    const returned = await arrangeActAssert({
      arrange: () => ({ a: 21 }),
      act,
      assert,
    });

    expect(act).toHaveBeenCalledWith({ a: 21 });
    expect(assert).toHaveBeenCalledWith({ a: 21, result: 42 });
    expect(returned).toBe('asserted');
  });

  it('awaits promises returned by arrange, act and assert', async () => {
    const assert = jest.fn(async () => 'async-asserted');

    const returned = await arrangeActAssert({
      arrange: () => Promise.resolve({ a: 1 }) as any,
      act: async ({ a }: { a: number }) => a + 1,
      assert,
    });

    expect(assert).toHaveBeenCalledWith({ a: 1, result: 2 });
    expect(returned).toBe('async-asserted');
  });

  it('propagates errors thrown by assert', async () => {
    await expect(
      arrangeActAssert({
        arrange: () => ({}),
        act: () => undefined,
        assert: () => {
          throw new Error('nope');
        },
      }),
    ).rejects.toThrow('nope');
  });
});
