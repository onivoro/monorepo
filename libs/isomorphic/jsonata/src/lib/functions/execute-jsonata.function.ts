import jsonata from 'jsonata';
import { IJsonataFn } from '../interfaces/jsonata-fn.interface';
import { IJsonataFunctions } from '../interfaces/jsonata-fn-config.interface';

export async function executeJsonata<TContext>(
  expression: string | null | undefined,
  context: TContext,
  functions?: IJsonataFunctions
) {

  if (!expression) {
    return undefined;
  }

  let header: string = '';

  const existingFnsWithOverridesApplied = (functions?.headerFunctions || [])
    .map((existing) => {
      const overridden = (functions?.auxilaryHeaderFunctions || [])
        .find(({ name }) => name === existing.name);

      if (overridden) {
        return overridden;
      }

      return existing;
    })

  const novelFns: IJsonataFn[] = (functions?.auxilaryHeaderFunctions || [])
    .filter(({ name }) => !existingFnsWithOverridesApplied.find(existing => existing.name === name));

  [
    ...existingFnsWithOverridesApplied,
    ...novelFns
  ]
    .map(({ name, body }) => {
      return '$' + `${name} := ${body.split('\n').join(' ')};\n`;
    })
    .forEach((body) => {
      header += body;
    });

  const expressionWithHeader = expression.replace('(', `(${header}\n`);

  const compiled = jsonata(expressionWithHeader);

  (functions?.registerFunctions || [])
    .forEach(({ name, fn }) => {
      compiled.registerFunction(name, fn as any);
    });

  return await compiled.evaluate(context);
}
