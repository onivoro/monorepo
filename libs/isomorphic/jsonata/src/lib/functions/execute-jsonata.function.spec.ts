import { executeJsonata } from './execute-jsonata.function';

describe('executeJsonata', () => {
  it.each([undefined, null, ''])(
    'returns undefined for an empty expression (%p)',
    async (expression) => {
      await expect(
        executeJsonata(expression, { a: 1 }),
      ).resolves.toBeUndefined();
    },
  );

  it('evaluates against the context', async () => {
    await expect(executeJsonata('a + b', { a: 1, b: 2 })).resolves.toBe(3);
  });

  it('resolves undefined when the path does not exist', async () => {
    await expect(executeJsonata('missing.path', {})).resolves.toBeUndefined();
  });

  it('includes auxiliary functions that do not override a header function', async () => {
    await expect(
      executeJsonata(
        '$double($triple(n))',
        { n: 2 },
        {
          headerFunctions: [
            { name: 'double', body: 'function($x) { $x * 2 }' },
          ],
          auxilaryHeaderFunctions: [
            { name: 'triple', body: 'function($x) { $x * 3 }' },
          ],
        },
      ),
    ).resolves.toBe(12);
  });

  it('supports auxiliary functions on their own', async () => {
    await expect(
      executeJsonata(
        '$inc(n)',
        { n: 1 },
        {
          auxilaryHeaderFunctions: [
            { name: 'inc', body: 'function($x) { $x + 1 }' },
          ],
        },
      ),
    ).resolves.toBe(2);
  });

  it('joins multi-line function bodies', async () => {
    await expect(
      executeJsonata(
        '$fmt(name)',
        { name: 'ada' },
        {
          headerFunctions: [
            {
              name: 'fmt',
              body: 'function($s) {\n  $uppercase(\n    $s\n  )\n}',
            },
          ],
        },
      ),
    ).resolves.toBe('ADA');
  });

  it('registers native functions', async () => {
    const shout = jest.fn((s: string) => `${s}!`);

    await expect(
      executeJsonata(
        '$shout(word)',
        { word: 'hey' },
        {
          registerFunctions: [{ name: 'shout', fn: shout }],
        },
      ),
    ).resolves.toBe('hey!');
    expect(shout).toHaveBeenCalledWith('hey');
  });

  it('rejects on a syntax error', async () => {
    await expect(executeJsonata('a +', {})).rejects.toBeDefined();
  });

  it('rejects when a function errors at runtime', async () => {
    await expect(
      executeJsonata(
        '$boom()',
        {},
        {
          registerFunctions: [
            {
              name: 'boom',
              fn: () => {
                throw new Error('kaboom');
              },
            },
          ],
        },
      ),
    ).rejects.toThrow('kaboom');
  });
});
