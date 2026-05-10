import { FindOperator } from 'typeorm';

export function buildWhereExpression(
  where: Record<string, any> | undefined,
  columns: Record<string, { databasePath: string }>,
): { whereClause: string; queryParams: any[] } {
  const queryParams: any[] = [];
  const clauses: string[] = [];

  for (const [propertyPath, value] of Object.entries(where || {})) {
    const rendered = renderClause(columns[propertyPath].databasePath, value, queryParams.length + 1);
    if (!rendered) continue;
    clauses.push(rendered.clause);
    if (rendered.hasParam) {
      queryParams.push(rendered.param);
    }
  }

  const whereClause = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  return { whereClause, queryParams };
}

type RenderedClause = { clause: string; param?: unknown; hasParam: boolean };

function renderClause(
  key: string,
  value: unknown,
  placeholderIndex: number,
): RenderedClause | null {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return { clause: `${key} IS NULL`, hasParam: false };
  }
  if (value instanceof FindOperator) {
    switch (value.type) {
      case 'isNull':
        return { clause: `${key} IS NULL`, hasParam: false };
      case 'in':
      case 'any':
        return { clause: `${key} = ANY($${placeholderIndex})`, param: value.value, hasParam: true };
      case 'equal':
        return { clause: `${key} = $${placeholderIndex}`, param: value.value, hasParam: true };
      default:
        throw new Error(
          `buildWhereExpression: FindOperator type "${value.type}" is not supported for raw SQL builds. ` +
          `Supported: "in", "any", "equal", "isNull". Column: "${key}".`,
        );
    }
  }
  return { clause: `${key} = $${placeholderIndex}`, param: value, hasParam: true };
}
