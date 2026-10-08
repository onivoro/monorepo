import { findAndReplace } from './find-and-replace.function';

describe('findAndReplace', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => errorSpy.mockRestore());

  it('replaces every occurrence of each placeholder', async () => {
    await expect(
      findAndReplace(
        '{{NAME}} owes {{AMOUNT}}. Thanks, {{NAME}}.',
        [
          { expression: 'NAME', code: 'person.name' },
          { expression: 'AMOUNT', code: '$sum(lines.amount)' },
        ],
        { person: { name: 'Ada' }, lines: [{ amount: 2 }, { amount: 3 }] },
      ),
    ).resolves.toBe('Ada owes 5. Thanks, Ada.');
  });

  it('matches placeholders whose expressions carry braces or whitespace', async () => {
    await expect(
      findAndReplace(
        'Hi {{NAME}}',
        [{ expression: '{{ NAME }}', code: '"Bob"' }],
        {},
      ),
    ).resolves.toBe('Hi Bob');
  });

  it('leaves placeholders whose expression evaluates to null', async () => {
    await expect(
      findAndReplace('x {{N}}', [{ expression: 'N', code: 'null' }], {}),
    ).resolves.toBe('x {{N}}');
  });

  it('leaves placeholders when the code is empty', async () => {
    await expect(
      findAndReplace('x {{N}}', [{ expression: 'N', code: '' }], {}),
    ).resolves.toBe('x {{N}}');
  });

  it('logs and skips expressions that fail, continuing with the rest', async () => {
    await expect(
      findAndReplace(
        '{{BAD}} {{GOOD}}',
        [
          { expression: 'BAD', code: 'a +' },
          { expression: 'GOOD', code: '"ok"' },
        ],
        {},
      ),
    ).resolves.toBe('{{BAD}} ok');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('passes functions through to the evaluator', async () => {
    await expect(
      findAndReplace(
        '{{GREETING}}',
        [{ expression: 'GREETING', code: '$hi(name)' }],
        { name: 'Ada' },
        {
          headerFunctions: [
            { name: 'hi', body: 'function($n) { "Hello " & $n }' },
          ],
        },
      ),
    ).resolves.toBe('Hello Ada');
  });

  it('returns content unchanged when there are no expressions', async () => {
    await expect(findAndReplace('{{A}}', [], {})).resolves.toBe('{{A}}');
  });

  it('inserts results containing "$&" literally', async () => {
    await expect(
      findAndReplace('{{P}}', [{ expression: 'P', code: '"a$&b"' }], {}),
    ).resolves.toBe('a$&b');
  });
});
