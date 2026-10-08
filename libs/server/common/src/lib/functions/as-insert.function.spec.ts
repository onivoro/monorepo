import { asInsert } from './as-insert.function';

describe('asInsert', () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
  });

  it('returns no statements for no objects', () => {
    expect(asInsert('t', [])).toEqual([]);
  });

  it('builds one statement per object with quoted identifiers', () => {
    expect(asInsert('user', [{ id: 1 }, { id: 2 }])).toEqual([
      'insert into "user" ("id") values (1);',
      'insert into "user" ("id") values (2);',
    ]);
  });

  it('renders each value type', () => {
    const [statement] = asInsert('t', [
      {
        s: 'abc',
        n: 4.5,
        t: true,
        f: false,
        nul: null,
        und: undefined,
        nullString: 'null',
        arr: [1, 'a'],
        obj: { k: 'v' },
      },
    ]);

    expect(statement).toBe(
      'insert into "t" ("s", "n", "t", "f", "nul", "und", "nullString", "arr", "obj") values ' +
        `('abc', 4.5, TRUE, FALSE, null, null, null, '[1,"a"]'::jsonb, '{"k":"v"}'::jsonb);`,
    );
  });

  it('logs columns whose rendered value is falsy', () => {
    asInsert('t', [{ zero: 0 }]);
    expect(log).toHaveBeenCalledWith('zero has value "0"');
  });
});
