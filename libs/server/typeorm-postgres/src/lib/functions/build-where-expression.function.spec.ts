import { Between, Equal, In, IsNull, LessThan, Like } from 'typeorm';
import { buildWhereExpression } from './build-where-expression.function';

describe(buildWhereExpression.name, () => {
  const columns = {
    id: { databasePath: 'id' },
    email: { databasePath: 'email_address' },
    status: { databasePath: 'status' },
  };

  it('returns an empty clause and no params when where is undefined', () => {
    const result = buildWhereExpression(undefined, columns);
    expect(result.whereClause).toBe('');
    expect(result.queryParams).toEqual([]);
  });

  it('returns an empty clause and no params when where is {}', () => {
    const result = buildWhereExpression({}, columns);
    expect(result.whereClause).toBe('');
    expect(result.queryParams).toEqual([]);
  });

  it('emits a scalar = $N clause and pushes the raw value', () => {
    const result = buildWhereExpression({ id: 42 }, columns);
    expect(result.whereClause).toBe(' WHERE id = $1');
    expect(result.queryParams).toEqual([42]);
  });

  it('unwraps a FindOperator array (In) to ANY($N) and pushes the inner array', () => {
    const result = buildWhereExpression({ id: In([1, 2, 3]) }, columns);
    expect(result.whereClause).toBe(' WHERE id = ANY($1)');
    expect(result.queryParams).toEqual([[1, 2, 3]]);
  });

  it('unwraps an Equal FindOperator and still uses = $N', () => {
    const result = buildWhereExpression({ status: Equal('active') }, columns);
    expect(result.whereClause).toBe(' WHERE status = $1');
    expect(result.queryParams).toEqual(['active']);
  });

  it('chains multiple conditions with AND and numbers placeholders correctly', () => {
    const result = buildWhereExpression(
      { id: 7, email: 'a@b.com', status: In(['active', 'pending']) },
      columns,
    );
    expect(result.whereClause).toBe(
      ' WHERE id = $1 AND email_address = $2 AND status = ANY($3)',
    );
    expect(result.queryParams).toEqual([7, 'a@b.com', ['active', 'pending']]);
  });

  it('maps propertyPath to databasePath for snake_cased columns', () => {
    const result = buildWhereExpression({ email: 'x@y.com' }, columns);
    expect(result.whereClause).toBe(' WHERE email_address = $1');
    expect(result.queryParams).toEqual(['x@y.com']);
  });

  it('emits IS NULL (no param) for a bare null value', () => {
    const result = buildWhereExpression({ status: null }, columns);
    expect(result.whereClause).toBe(' WHERE status IS NULL');
    expect(result.queryParams).toEqual([]);
  });

  it('emits IS NULL (no param) for IsNull()', () => {
    const result = buildWhereExpression({ status: IsNull() }, columns);
    expect(result.whereClause).toBe(' WHERE status IS NULL');
    expect(result.queryParams).toEqual([]);
  });

  it('skips keys whose value is undefined', () => {
    const result = buildWhereExpression({ id: 1, status: undefined, email: 'a@b.com' }, columns);
    expect(result.whereClause).toBe(' WHERE id = $1 AND email_address = $2');
    expect(result.queryParams).toEqual([1, 'a@b.com']);
  });

  it('numbers placeholders by param count, not key index, when IS NULL is mixed in', () => {
    const result = buildWhereExpression(
      { status: null, id: 5, email: 'a@b.com' },
      columns,
    );
    expect(result.whereClause).toBe(
      ' WHERE status IS NULL AND id = $1 AND email_address = $2',
    );
    expect(result.queryParams).toEqual([5, 'a@b.com']);
  });

  it('throws on Between', () => {
    expect(() => buildWhereExpression({ id: Between(1, 5) }, columns)).toThrow(
      /FindOperator type "between" is not supported/,
    );
  });

  it('throws on LessThan', () => {
    expect(() => buildWhereExpression({ id: LessThan(10) }, columns)).toThrow(
      /FindOperator type "lessThan" is not supported/,
    );
  });

  it('throws on Like', () => {
    expect(() => buildWhereExpression({ email: Like('%@b.com') }, columns)).toThrow(
      /FindOperator type "like" is not supported/,
    );
  });
});
