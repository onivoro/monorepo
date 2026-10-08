import { NotImplementedException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
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
  const metadataColumns = Object.entries(columnsSpec).map(
    ([propertyPath, c]) => ({
      propertyPath,
      databasePath: c.databasePath,
      type: c.type ?? 'varchar',
      isPrimary: c.isPrimary ?? false,
      default: c.default,
    }),
  );
  const fakeRepo = {
    metadata: {
      target: EntityClass,
      columns: metadataColumns,
      tableName,
      schema,
    },
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
      const { fakeManager, EntityClass, query } = buildFixture(
        'events',
        'public',
        {
          id: { databasePath: 'id' },
          status: { databasePath: 'status' },
        },
      );
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
      const { fakeManager, EntityClass, query } = buildFixture(
        'events',
        'public',
        {
          id: { databasePath: 'id' },
          status: { databasePath: 'status' },
          data: { databasePath: 'data', type: 'jsonb' },
        },
      );
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);
      await repo.patch(
        { id: 'e1' },
        { status: 'active', data: { foo: 'bar' } },
      );
      const [sql, params] = query.mock.calls[0];
      expect(sql).toBe(
        'UPDATE "public"."events" SET status = $2, data = JSON_PARSE($3)  WHERE id = $1',
      );
      expect(params).toEqual(['e1', 'active', { foo: 'bar' }]);
    });
  });

  describe('softDelete', () => {
    it('patches deletedAt with a valid ISO string', async () => {
      const { fakeManager, EntityClass, query } = buildFixture(
        'events',
        'public',
        {
          id: { databasePath: 'id' },
          deletedAt: { databasePath: 'deleted_at' },
        },
      );
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
      const { fakeManager, EntityClass, query } = buildFixture(
        'events',
        'public',
        {
          id: { databasePath: 'id' },
        },
      );
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
      expect((repo as any).mapPlaceholderExpression(0, 1, 'data')).toBe(
        'JSON_PARSE($2)',
      );
    });
  });

  describe('unsupported operations', () => {
    it('forTransaction throws NotImplementedException', () => {
      const { fakeManager, EntityClass } = buildFixture('events', 'public', {
        id: { databasePath: 'id' },
      });
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);
      expect(() => repo.forTransaction(fakeManager)).toThrow(
        NotImplementedException,
      );
    });

    it.each([
      ['put', [{}]],
      ['getManyAndCount', [{}]],
      ['postManyWithoutReturn', [[]]],
      ['head', [{}]],
    ] as const)(
      '%s rejects with NotImplementedException',
      async (method, args) => {
        const { fakeManager, EntityClass } = buildFixture('events', 'public', {
          id: { databasePath: 'id' },
        });
        const repo = new RedshiftRepository<any>(EntityClass, fakeManager);
        await expect((repo as any)[method](...args)).rejects.toThrow(
          /has no implementation for/,
        );
      },
    );
  });

  describe('getMany / getOne', () => {
    const columns = {
      id: { databasePath: 'id' },
      orgId: { databasePath: 'org_id' },
      createdBy: { databasePath: 'created_by' },
    };

    it('selects with a raw WHERE clause and maps rows to entities', async () => {
      const query = jest
        .fn()
        .mockResolvedValue([{ id: 'e1', org_id: 'o1', created_by: 'u1' }]);
      const { fakeManager, EntityClass } = buildFixture(
        'events',
        'analytics',
        columns,
        query,
      );
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);

      const rows = await repo.getMany({
        where: { orgId: In(['o1', 'o2']), createdBy: 'u1' },
      });

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM "analytics"."events" WHERE org_id = ANY($1) AND created_by = $2;',
        [['o1', 'o2'], 'u1'],
      );
      expect(rows).toEqual([{ id: 'e1', orgId: 'o1', createdBy: 'u1' }]);
    });

    it('selects everything when there is no where', async () => {
      const { fakeManager, EntityClass, query } = buildFixture(
        'events',
        'public',
        columns,
      );
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);

      await repo.getMany({});

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM "public"."events";',
        [],
      );
    });

    it('getOne returns the single match or undefined', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([{ id: 'e1' }])
        .mockResolvedValueOnce([]);
      const { fakeManager, EntityClass } = buildFixture(
        'events',
        'public',
        columns,
        query,
      );
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);

      expect(await repo.getOne({ where: { id: 'e1' } })).toEqual(
        expect.objectContaining({ id: 'e1' }),
      );
      expect(await repo.getOne({ where: { id: 'nope' } })).toBeUndefined();
    });

    it('getOne throws when more than one row matches', async () => {
      const query = jest.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
      const { fakeManager, EntityClass } = buildFixture(
        'events',
        'public',
        columns,
        query,
      );
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);

      await expect(repo.getOne({ where: {} })).rejects.toThrow(
        'RedshiftRepository.getOne expected one result but found 2 results',
      );
    });
  });

  describe('delete', () => {
    it('emits a parameterized DELETE', async () => {
      const { fakeManager, EntityClass, query } = buildFixture(
        'events',
        'public',
        {
          id: { databasePath: 'id' },
          orgId: { databasePath: 'org_id' },
        },
      );
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);

      await expect(
        repo.delete({ id: 'e1', orgId: 'o1' }),
      ).resolves.toBeUndefined();

      expect(query).toHaveBeenCalledWith(
        'DELETE FROM "public"."events" WHERE id = $1 AND org_id = $2;',
        ['e1', 'o1'],
      );
    });
  });

  describe('patch with multiple conditions', () => {
    it('joins WHERE conditions with AND and numbers SET placeholders after them', async () => {
      const { fakeManager, EntityClass, query } = buildFixture('events', '', {
        id: { databasePath: 'id' },
        orgId: { databasePath: 'org_id' },
        status: { databasePath: 'status' },
        note: { databasePath: 'note' },
      });
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);

      await repo.patch(
        { id: 'e1', orgId: 'o1' },
        { status: 'done', note: 'n' },
      );

      expect(query).toHaveBeenCalledWith(
        'UPDATE "events" SET status = $3, note = $4  WHERE id = $1 AND org_id = $2',
        ['e1', 'o1', 'done', 'n'],
      );
    });
  });

  describe('inserts', () => {
    const columns = {
      id: { databasePath: 'id' },
      payload: { databasePath: 'payload', type: 'jsonb' },
      status: { databasePath: 'status', default: 'new' },
    };

    it('postOneWithoutReturn emits an INSERT with JSON_PARSE for jsonb columns', async () => {
      const { fakeManager, EntityClass, query } = buildFixture(
        'events',
        'public',
        columns,
      );
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);

      await expect(
        repo.postOneWithoutReturn({ id: 'e1', payload: '{"a":1}' }),
      ).resolves.toBeUndefined();

      expect(query).toHaveBeenCalledWith(
        'INSERT INTO "public"."events" (id, payload) VALUES ($1, JSON_PARSE($2))',
        ['e1', '{"a":1}'],
      );
    });

    it('postOne inserts then selects the row back by its values', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'e1', payload: null, status: 'new' }]);
      const { fakeManager, EntityClass } = buildFixture(
        'events',
        'public',
        columns,
        query,
      );
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);

      const created = await repo.postOne({ id: 'e1' });

      expect(query).toHaveBeenNthCalledWith(
        1,
        'INSERT INTO "public"."events" (id) VALUES ($1)',
        ['e1'],
      );
      expect(query).toHaveBeenNthCalledWith(
        2,
        'SELECT * FROM "public"."events" WHERE id = $1;',
        ['e1'],
      );
      expect(created).toEqual({ id: 'e1', payload: null, status: 'new' });
    });

    it('postMany inserts all rows, then selects them back with a UNION query', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'e1', payload: null, status: 'new' },
          { id: 'e2', payload: null, status: 'done' },
        ]);
      const { fakeManager, EntityClass } = buildFixture(
        'events',
        'public',
        columns,
        query,
      );
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);

      const created = await repo.postMany([
        { id: 'e1' },
        { id: 'e2', status: 'done' },
      ]);

      expect(query).toHaveBeenNthCalledWith(
        1,
        'INSERT INTO "public"."events" (id, status) VALUES ($1, $2), ($3, $4)',
        ['e1', 'new', 'e2', 'done'],
      );
      expect(query).toHaveBeenNthCalledWith(
        2,
        '(select * from "public"."events" where ((id = $1) AND (status = $2))) UNION (select * from "public"."events" where ((id = $3) AND (status = $4)))',
        ['e1', 'new', 'e2', 'done'],
      );
      expect(created.map((e) => e.id)).toEqual(['e1', 'e2']);
    });

    it('postMany returns [] for undefined input', async () => {
      const { fakeManager, EntityClass, query } = buildFixture(
        'events',
        'public',
        columns,
      );
      const repo = new RedshiftRepository<any>(EntityClass, fakeManager);

      expect(await repo.postMany(undefined as any)).toEqual([]);
      expect(query).not.toHaveBeenCalled();
    });
  });

  it('includes the entity type and feature in NotImplementedException messages', async () => {
    const { fakeManager } = buildFixture('events', 'public', {
      id: { databasePath: 'id' },
    });
    const repo = new RedshiftRepository<any>('EventEntity', fakeManager);

    await expect(repo.head({})).rejects.toThrow(
      'RedshiftRepository of type "EventEntity" has no implementation for "head"',
    );
  });
});
