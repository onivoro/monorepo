import { JsonataExpressionService } from './classes/jsonata-expression.class';
import { executeJsonata } from './functions/execute-jsonata.function';
import { findAndReplace } from './functions/find-and-replace.function';
import { IJsonataFunctions } from './interfaces/jsonata-fn-config.interface';

describe('JsonataExpressionService', () => {
  const svc = new JsonataExpressionService();

  it('adds braces to each interpolation', () => {
    expect(svc.addBracesToInterpolations([' A ', '{{B}}'])).toEqual([
      '{{A}}',
      '{{B}}',
    ]);
  });

  it('removes braces from each interpolation', () => {
    expect(svc.removeBracesFromInterpolations(['{{ A }}', 'B'])).toEqual([
      'A',
      'B',
    ]);
  });
});

describe('executeJsonata', () => {
  const functions: IJsonataFunctions = {
    headerFunctions: [
      { name: 'greet', body: 'function($n) { "Hello, " & $n }' },
    ],
  };

  it('makes header functions available to a block', async () => {
    expect(
      await executeJsonata('( $greet(name) )', { name: 'Ada' }, functions),
    ).toBe('Hello, Ada');
  });

  // the header used to be spliced in after the first "(", which here is the
  // call's argument list
  it('makes header functions available to a bare function call', async () => {
    expect(
      await executeJsonata('$greet(name)', { name: 'Ada' }, functions),
    ).toBe('Hello, Ada');
  });

  // ...and here there is no "(" at all, so the header was dropped
  it('makes header functions available to an expression with no parentheses', async () => {
    expect(
      await executeJsonata(
        '$greet ~> |$|{}|',
        {},
        { headerFunctions: [{ name: 'greet', body: '{"a": 1}' }] },
      ),
    ).toEqual({ a: 1 });
  });

  it('lets auxiliary functions override header functions', async () => {
    expect(
      await executeJsonata(
        '$greet(name)',
        { name: 'Ada' },
        {
          ...functions,
          auxilaryHeaderFunctions: [
            { name: 'greet', body: 'function($n) { "Hi, " & $n }' },
          ],
        },
      ),
    ).toBe('Hi, Ada');
  });

  it('evaluates an expression without functions unchanged', async () => {
    expect(
      await executeJsonata('$sum(items.price)', {
        items: [{ price: 2 }, { price: 3 }],
      }),
    ).toBe(5);
  });
});

describe('findAndReplace', () => {
  it('replaces placeholders with zero and false', async () => {
    expect(
      await findAndReplace(
        'total {{TOTAL}}, paid {{PAID}}',
        [
          { expression: 'TOTAL', code: 'total' },
          { expression: 'PAID', code: 'paid' },
        ],
        { total: 0, paid: false },
      ),
    ).toBe('total 0, paid false');
  });

  it('leaves a placeholder whose expression yields nothing', async () => {
    expect(
      await findAndReplace(
        'hi {{NAME}}',
        [{ expression: 'NAME', code: 'missing' }],
        {},
      ),
    ).toBe('hi {{NAME}}');
  });
});
