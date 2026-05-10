import { NotImplementedException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RedshiftRepository } from './redshift-repository.class';

type ColumnSpec = Record<
  string,
  { databasePath: string; type?: any; isPrimary?: boolean; default?: unknown }
>;

function buildFixture(
  tableName: string,
  schema: string,
  columnsSpec: ColumnSpec,
  query: jest.Mock = jest.fn().mockResolvedValue([]),
) {
  const EntityClass = class {};
  const metadataColumns = Object.entries(columnsSpec).map(([propertyPath, c]) => ({
    propertyPath,
    databasePath: c.databasePath,
    type: c.type ?? 'varchar',
    isPrimary: c.isPrimary ?? false,
    default: c.default,
  }));
  const fakeRepo = {
    metadata: { target: EntityClass, columns: metadataColumns, tableName, schema },
    query,
  };
  const fakeManager = {
    getRepository: jest.fn(() => fakeRepo),
  } as unknown as EntityManager;
  return { fakeManager, fakeRepo, EntityClass, query };
}

describe(RedshiftRepository.name, () => {
  describe('patch', () => {
    it('emits UPDATE with WHERE placeholders first, SET placeholders numbered after, and concatenates params', async () => {
      const { fakeManager, EntityClass, query } = buildFixture('events', 'public', {
        id: { databasePath: 'id' },
        status: { databasePath: 'status' },
      });
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);
      await repo.patch({ id: 'e1' }, { status: 'active' });
      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toBe(
        'UPDATE "public"."events" SET status = $2  WHERE id = $1',
      );
      expect(params).toEqual(['e1', 'active']);
    });

    it('wraps jsonb SET values with JSON_PARSE(...)', async () => {
      const { fakeManager, EntityClass, query } = buildFixture('events', 'public', {
        id: { databasePath: 'id' },
        status: { databasePath: 'status' },
        data: { databasePath: 'data', type: 'jsonb' },
      });
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);
      await repo.patch({ id: 'e1' }, { status: 'active', data: { foo: 'bar' } });
      const [sql, params] = query.mock.calls[0];
      expect(sql).toBe(
        'UPDATE "public"."events" SET status = $2, data = JSON_PARSE($3)  WHERE id = $1',
      );
      expect(params).toEqual(['e1', 'active', { foo: 'bar' }]);
    });
  });

  describe('softDelete', () => {
    it('patches deletedAt with a valid ISO string', async () => {
      const { fakeManager, EntityClass, query } = buildFixture('events', 'public', {
        id: { databasePath: 'id' },
        deletedAt: { databasePath: 'deleted_at' },
      });
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);
      await repo.softDelete({ id: 'e1' } as any);
      expect(query).toHaveBeenCalledTimes(1);
      const [, params] = query.mock.calls[0];
      expect(params[0]).toBe('e1');
      expect(typeof params[1]).toBe('string');
      expect(Number.isNaN(Date.parse(params[1] as string))).toBe(false);
    });
  });

  describe('postMany', () => {
    it('returns [] without querying when given an empty array', async () => {
      const { fakeManager, EntityClass, query } = buildFixture('events', 'public', {
        id: { databasePath: 'id' },
      });
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);
      expect(await repo.postMany([])).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('mapPlaceholderExpression', () => {
    it('wraps jsonb columns with JSON_PARSE and leaves other columns as $N', () => {
      const { fakeManager, EntityClass } = buildFixture('events', 'public', {
        id: { databasePath: 'id' },
        data: { databasePath: 'data', type: 'jsonb' },
      });
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);
      expect((repo as any).mapPlaceholderExpression(0, 0, 'id')).toBe('$1');
      expect((repo as any).mapPlaceholderExpression(0, 1, 'data')).toBe('JSON_PARSE($2)');
    });
  });

  describe('unsupported operations', () => {
    it('forTransaction throws NotImplementedException', () => {
      const { fakeManager, EntityClass } = buildFixture('events', 'public', { id: { databasePath: 'id' } });
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);
      expect(() => repo.forTransaction(fakeManager)).toThrow(NotImplementedException);
    });

    it.each([
      ['put', [{}]],
      ['getManyAndCount', [{}]],
      ['postManyWithoutReturn', [[]]],
      ['head', [{}]],
    ] as const)('%s rejects with NotImplementedException', async (method, args) => {
      const { fakeManager, EntityClass } = buildFixture('events', 'public', { id: { databasePath: 'id' } });
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);
      await expect((repo as any)[method](...args)).rejects.toThrow(/has no implementation for/);
    });
  });
});
