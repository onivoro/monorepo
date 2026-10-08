import { EntityManager, ILike, In } from 'typeorm';
import { TypeOrmRepository } from './type-orm-repository.class';

type ColumnSpec = Record<
  string,
  { databasePath: string; type?: any; isPrimary?: boolean; default?: unknown }
>;

interface FakeRepoOverrides {
  find?: jest.Mock;
  findAndCount?: jest.Mock;
  save?: jest.Mock;
  delete?: jest.Mock;
  softDelete?: jest.Mock;
  update?: jest.Mock;
  exists?: jest.Mock;
  query?: jest.Mock;
}

function buildFixture(
  tableName: string,
  schema: string,
  columnsSpec: ColumnSpec,
  overrides: FakeRepoOverrides = {},
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
    find: overrides.find ?? jest.fn(),
    findAndCount: overrides.findAndCount ?? jest.fn(),
    save: overrides.save ?? jest.fn(),
    delete: overrides.delete ?? jest.fn(),
    softDelete: overrides.softDelete ?? jest.fn(),
    update: overrides.update ?? jest.fn(),
    exists: overrides.exists ?? jest.fn(),
    query: overrides.query ?? jest.fn(),
  };
  const fakeManager = {
    getRepository: jest.fn(() => fakeRepo),
  } as unknown as EntityManager;
  return { fakeManager, fakeRepo, EntityClass };
}

describe(TypeOrmRepository.name + ' (postgres)', () => {
  describe('getOne', () => {
    it('returns undefined when find returns []', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { find },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      expect(await repo.getOne({ where: { id: 'x' } })).toBeUndefined();
    });

    it('returns the single row when find returns one', async () => {
      const find = jest.fn().mockResolvedValue([{ id: 'x' }]);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { find },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      expect(await repo.getOne({ where: { id: 'x' } })).toEqual({ id: 'x' });
    });

    it('throws with a descriptive error when find returns >1', async () => {
      const find = jest.fn().mockResolvedValue([{ id: 'x' }, { id: 'y' }]);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { find },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      await expect(repo.getOne({ where: {} })).rejects.toThrow(
        /getOne expects only 1 result but found 2 results/,
      );
    });
  });

  describe('getTableNameExpression', () => {
    it('includes a quoted schema prefix when schema is set', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      expect((repo as any).getTableNameExpression()).toBe('"public"."users"');
    });

    it('omits the schema prefix when schema is empty', () => {
      const { fakeManager, EntityClass } = buildFixture('users', '', {
        id: { databasePath: 'id' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      expect((repo as any).getTableNameExpression()).toBe('"users"');
    });
  });

  describe('buildInsertQuery', () => {
    it('emits a parameterized INSERT with databasePath column names', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id', isPrimary: true },
        email: { databasePath: 'email_address' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      const result = (repo as any).buildInsertQuery({
        id: 'u1',
        email: 'a@b.com',
      });
      expect(result.insertQuery).toBe(
        'INSERT INTO "public"."users" (id, email_address) VALUES ($1, $2)',
      );
      expect(result.values).toEqual(['u1', 'a@b.com']);
    });
  });

  describe('buildInsertManyQuery', () => {
    it('unions keys across rows, substitutes column default for missing keys, and numbers placeholders continuously', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
        email: { databasePath: 'email_address' },
        status: { databasePath: 'status', default: 'active' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      const result = (repo as any).buildInsertManyQuery([
        { id: 'u1', email: 'a@b.com' },
        { id: 'u2', status: 'banned' },
      ]);
      expect(result.insertQuery).toBe(
        'INSERT INTO "public"."users" (id, email_address, status) VALUES ($1, $2, $3), ($4, $5, $6)',
      );
      // Row 1: u1, a@b.com, (missing status → default 'active')
      // Row 2: u2, (missing email → default undefined), banned
      expect(result.values).toEqual([
        'u1',
        'a@b.com',
        'active',
        'u2',
        undefined,
        'banned',
      ]);
    });
  });

  describe('buildSelectManyQuery', () => {
    it('emits a UNION of parameterized SELECTs, one per row', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
        email: { databasePath: 'email_address' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      const result = (repo as any).buildSelectManyQuery([
        { id: 'u1', email: 'a@b.com' },
        { id: 'u2', email: 'c@d.com' },
      ]);
      expect(result.selectQuery).toBe(
        '(select * from "public"."users" where ((id = $1) AND (email_address = $2))) UNION (select * from "public"."users" where ((id = $3) AND (email_address = $4)))',
      );
      expect(result.values).toEqual(['u1', 'a@b.com', 'u2', 'c@d.com']);
    });
  });

  describe('buildWhereILike', () => {
    it('returns {} when filters is undefined', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      expect(repo.buildWhereILike(undefined)).toEqual({});
    });

    it('drops falsy filter values and wraps truthy ones in ILike(%...%)', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
        email: { databasePath: 'email_address' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      const result = repo.buildWhereILike({
        email: 'a@b',
        id: undefined,
        other: '',
      });
      expect(Object.keys(result)).toEqual(['email']);
      // ILike returns a FindOperator whose .value is the wrapped literal
      expect(JSON.stringify((result as any).email)).toBe(
        JSON.stringify(ILike('%a@b%')),
      );
    });
  });

  describe('map', () => {
    it('rekeys raw DB columns to entity propertyPaths and ignores extras', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
        email: { databasePath: 'email_address' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      expect(
        repo.map({ id: 'u1', email_address: 'a@b.com', extra: 'ignored' }),
      ).toEqual({
        id: 'u1',
        email: 'a@b.com',
      });
    });
  });

  describe('forTransaction', () => {
    it('returns a new instance bound to the provided EntityManager', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      const other = {
        getRepository: jest.fn(() => ({
          metadata: {
            target: EntityClass,
            columns: [],
            tableName: 'users',
            schema: 'public',
          },
        })),
      } as unknown as EntityManager;
      const forked = repo.forTransaction(other);
      expect(forked).not.toBe(repo);
      expect(forked).toBeInstanceOf(TypeOrmRepository);
      expect(forked.entityManager).toBe(other);
      expect(forked.entityType).toBe(EntityClass);
    });
  });

  describe('head', () => {
    it('calls exists with withDeleted=true by default', async () => {
      const exists = jest.fn().mockResolvedValue(true);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { exists },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      await repo.head({ id: 'x' } as any);
      expect(exists).toHaveBeenCalledWith({
        where: { id: 'x' },
        withDeleted: true,
      });
    });

    it('passes withDeleted=false through when explicitly set', async () => {
      const exists = jest.fn().mockResolvedValue(false);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { exists },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      await repo.head({ id: 'x' } as any, false);
      expect(exists).toHaveBeenCalledWith({
        where: { id: 'x' },
        withDeleted: false,
      });
    });
  });

  describe('metadata', () => {
    it('exposes columns, table and schema from the repository metadata', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'app', {
        id: { databasePath: 'id', isPrimary: true, type: 'uuid' },
        email: { databasePath: 'email_address', default: 'none' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(repo.table).toBe('users');
      expect(repo.schema).toBe('app');
      expect(repo.columns).toEqual({
        id: {
          databasePath: 'id',
          type: 'uuid',
          propertyPath: 'id',
          isPrimary: true,
          default: undefined,
        },
        email: {
          databasePath: 'email_address',
          type: 'varchar',
          propertyPath: 'email',
          isPrimary: false,
          default: 'none',
        },
      });
    });

    it('treats a missing schema as an empty string', () => {
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        undefined as any,
        { id: { databasePath: 'id' } },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(repo.schema).toBe('');
      expect((repo as any).getTableNameExpression()).toBe('"users"');
    });

    it('reads metadata once per instance and caches it across instances of the same entity', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
      });
      const first = new TypeOrmRepository<any>(EntityClass, fakeManager);
      const second = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(first.columns).toBe(second.columns);

      // once an instance has its snapshot, further reads don't touch the repository
      const getRepository = fakeManager.getRepository as jest.Mock;
      const callsAfterFirstRead = getRepository.mock.calls.length;
      void first.table;
      void first.schema;
      void second.columns;
      expect(getRepository.mock.calls.length).toBe(callsAfterFirstRead);
    });
  });

  describe('pass-through methods', () => {
    it('getMany and getManyAndCount delegate to find/findAndCount', async () => {
      const find = jest.fn().mockResolvedValue([{ id: 'a' }]);
      const findAndCount = jest.fn().mockResolvedValue([[{ id: 'a' }], 1]);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { find, findAndCount },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(await repo.getMany({ where: { id: 'a' } })).toEqual([{ id: 'a' }]);
      expect(await repo.getManyAndCount({ take: 1 })).toEqual([
        [{ id: 'a' }],
        1,
      ]);
      expect(find).toHaveBeenCalledWith({ where: { id: 'a' } });
      expect(findAndCount).toHaveBeenCalledWith({ take: 1 });
      expect(fakeManager.getRepository).toHaveBeenCalledWith(EntityClass);
    });

    it('delete, softDelete and patch delegate and resolve undefined', async () => {
      const del = jest.fn().mockResolvedValue({ affected: 1 });
      const softDelete = jest.fn().mockResolvedValue({ affected: 1 });
      const update = jest.fn().mockResolvedValue({ affected: 1 });
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { delete: del, softDelete, update },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      await expect(repo.delete({ id: 'a' })).resolves.toBeUndefined();
      await expect(repo.softDelete({ id: 'b' })).resolves.toBeUndefined();
      await expect(
        repo.patch({ id: 'c' }, { name: 'n' }),
      ).resolves.toBeUndefined();
      expect(del).toHaveBeenCalledWith({ id: 'a' });
      expect(softDelete).toHaveBeenCalledWith({ id: 'b' });
      expect(update).toHaveBeenCalledWith({ id: 'c' }, { name: 'n' });
    });

    it('put saves entities with options', async () => {
      const save = jest.fn(async (x: any) => x);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { save },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(await repo.put([{ id: 'a' }], { reload: false })).toEqual([
        { id: 'a' },
      ]);
      expect(save).toHaveBeenCalledWith([{ id: 'a' }], { reload: false });
    });
  });

  describe('postOne / postMany', () => {
    function withInsertBuilder(generatedMaps: any[]) {
      const fixture = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
      });
      const builder: any = {
        insert: jest.fn(() => builder),
        values: jest.fn(() => builder),
        returning: jest.fn(() => builder),
        execute: jest.fn().mockResolvedValue({ generatedMaps }),
      };
      (fixture.fakeRepo as any).createQueryBuilder = jest.fn(() => builder);
      return { ...fixture, builder };
    }

    it('postMany inserts all rows with RETURNING * and resolves the generated maps', async () => {
      const { fakeManager, EntityClass, builder } = withInsertBuilder([
        { id: 'a' },
        { id: 'b' },
      ]);
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(await repo.postMany([{ name: 'a' }, { name: 'b' }])).toEqual([
        { id: 'a' },
        { id: 'b' },
      ]);
      expect(builder.values).toHaveBeenCalledWith([
        { name: 'a' },
        { name: 'b' },
      ]);
      expect(builder.returning).toHaveBeenCalledWith('*');
    });

    it('postOne inserts a single row and resolves the first generated map', async () => {
      const { fakeManager, EntityClass, builder } = withInsertBuilder([
        { id: 'a', name: 'x' },
      ]);
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(await repo.postOne({ name: 'x' })).toEqual({ id: 'a', name: 'x' });
      expect(builder.values).toHaveBeenCalledWith([{ name: 'x' }]);
    });

    it('propagates insert failures', async () => {
      const { fakeManager, EntityClass, builder } = withInsertBuilder([]);
      builder.execute.mockRejectedValue(new Error('duplicate key'));
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      await expect(repo.postOne({ name: 'x' })).rejects.toThrow(
        'duplicate key',
      );
    });
  });

  describe('getManyGroupedBy', () => {
    function withSelectBuilder(rows: any[]) {
      const fixture = buildFixture('orders', 'public', {
        status: { databasePath: 'status' },
      });
      const builder: any = {
        select: jest.fn(() => builder),
        addSelect: jest.fn(() => builder),
        where: jest.fn(() => builder),
        addOrderBy: jest.fn(() => builder),
        addGroupBy: jest.fn(() => builder),
        getRawMany: jest.fn().mockResolvedValue(rows),
      };
      (fixture.fakeRepo as any).createQueryBuilder = jest.fn(() => builder);
      return { ...fixture, builder };
    }

    it('builds select/addSelect, where, order and group by clauses', async () => {
      const rows = [{ status: 'open', total: '3' }];
      const { fakeManager, EntityClass, builder } = withSelectBuilder(rows);
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      const result = await repo.getManyGroupedBy<{
        status: string;
        total: string;
      }>({
        select: { status: 'status', total: 'COUNT(*)' },
        where: { customerId: 'c1' },
        order: { total: 'DESC', status: 'ASC' },
        groupBy: ['status'],
      });

      expect(result).toBe(rows);
      expect(builder.select).toHaveBeenCalledWith('status', 'status');
      expect(builder.addSelect).toHaveBeenCalledWith('COUNT(*)', 'total');
      expect(builder.where).toHaveBeenCalledWith({ customerId: 'c1' });
      expect(builder.addOrderBy.mock.calls).toEqual([
        ['total', 'DESC'],
        ['status', 'ASC'],
      ]);
      expect(builder.addGroupBy).toHaveBeenCalledWith('status');
    });

    it('omits where and order when not given', async () => {
      const { fakeManager, EntityClass, builder } = withSelectBuilder([]);
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      await repo.getManyGroupedBy<{ n: string }>({
        select: { n: 'COUNT(*)' },
        groupBy: [],
      });

      expect(builder.select).toHaveBeenCalledTimes(1);
      expect(builder.addSelect).not.toHaveBeenCalled();
      expect(builder.where).not.toHaveBeenCalled();
      expect(builder.addOrderBy).not.toHaveBeenCalled();
      expect(builder.addGroupBy).not.toHaveBeenCalled();
    });
  });

  describe('raw SQL statements', () => {
    const columns = {
      id: { databasePath: 'id' },
      orgId: { databasePath: 'org_id' },
      deletedAt: { databasePath: 'deleted_at' },
    };

    it('buildSelectStatement renders a WHERE clause from options.where', () => {
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        columns,
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(
        (repo as any).buildSelectStatement({
          where: { orgId: In(['a', 'b']), deletedAt: null },
        }),
      ).toEqual({
        query:
          'SELECT * FROM "public"."users" WHERE org_id = ANY($1) AND deleted_at IS NULL;',
        queryParams: [['a', 'b']],
      });
    });

    it('buildSelectStatement omits WHERE when there are no conditions', () => {
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        columns,
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect((repo as any).buildSelectStatement({})).toEqual({
        query: 'SELECT * FROM "public"."users";',
        queryParams: [],
      });
    });

    it('buildDeleteStatement renders a parameterized DELETE', () => {
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        columns,
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect((repo as any).buildDeleteStatement({ id: 'u1' })).toEqual({
        query: 'DELETE FROM "public"."users" WHERE id = $1;',
        queryParams: ['u1'],
      });
    });

    it('mapPlaceholderExpression numbers placeholders after the offset', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
        data: { databasePath: 'data', type: 'jsonb' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect((repo as any).mapPlaceholderExpression(3, 1, 'id')).toBe('$5');
      expect((repo as any).mapPlaceholderExpression(0, 0, 'data')).toBe('$1');
    });
  });

  describe('query / queryAndMap', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => logSpy.mockRestore());

    it('runs the query through the repository without logging by default', async () => {
      const query = jest.fn().mockResolvedValue([{ id: 1 }]);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { query },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(await repo.query('SELECT 1', ['p'])).toEqual([{ id: 1 }]);
      expect(query).toHaveBeenCalledWith('SELECT 1', ['p']);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('logs the query and the result when debug is on', async () => {
      const query = jest.fn().mockResolvedValue([{ id: 1 }]);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { query },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      repo.debug = true;

      await repo.query('SELECT 1', []);

      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenNthCalledWith(1, {
        schema: 'public',
        table: 'users',
        query: 'SELECT 1',
        parameters: [],
      });
      expect(logSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ result: [{ id: 1 }] }),
      );
    });

    it('queryAndMap maps raw rows to entities', async () => {
      const query = jest
        .fn()
        .mockResolvedValue([{ id: 'u1', email_address: 'a@b' }]);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        {
          id: { databasePath: 'id' },
          email: { databasePath: 'email_address' },
        },
        { query },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(await repo.queryAndMap('SELECT *', [])).toEqual([
        { id: 'u1', email: 'a@b' },
      ]);
    });

    it('queryAndMap tolerates a nullish result', async () => {
      const query = jest.fn().mockResolvedValue(undefined);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { query },
      );
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);

      expect(await repo.queryAndMap('SELECT *', [])).toBeUndefined();
    });
  });

  describe('forTransaction with subclasses', () => {
    it('preserves a subclass that keeps the (entityType, entityManager) constructor', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
      });
      class Sub extends TypeOrmRepository<any> {}

      const forked = new Sub(EntityClass, fakeManager).forTransaction(
        fakeManager,
      );

      expect(forked).toBeInstanceOf(Sub);
      expect(forked.entityType).toBe(EntityClass);
    });

    it('works for subclasses with a one-argument constructor', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
      });
      class Sub extends TypeOrmRepository<any> {
        constructor(em: EntityManager) {
          super(EntityClass, em);
        }
      }
      const other = { getRepository: jest.fn() } as unknown as EntityManager;
      const forked = new Sub(fakeManager).forTransaction(other);

      expect(forked).toBeInstanceOf(Sub);
      expect(forked.entityManager).toBe(other);
      expect(forked.entityType).toBe(EntityClass);
    });

    it('binds the fork to the new manager while the original keeps its own', async () => {
      const originalQuery = jest.fn().mockResolvedValue([{ id: 'a' }]);
      const txQuery = jest.fn().mockResolvedValue([{ id: 'b' }]);
      const { fakeManager, EntityClass } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { query: originalQuery },
      );
      const { fakeManager: txManager } = buildFixture(
        'users',
        'public',
        { id: { databasePath: 'id' } },
        { query: txQuery },
      );
      class Sub extends TypeOrmRepository<any> {
        constructor(em: EntityManager) {
          super(EntityClass, em);
        }
      }
      const repo = new Sub(fakeManager);
      expect(repo.table).toBe('users');

      const forked = repo.forTransaction(txManager);

      expect(forked.table).toBe('users');
      expect(await forked.query('SELECT 1', [])).toEqual([{ id: 'b' }]);
      expect(await repo.query('SELECT 1', [])).toEqual([{ id: 'a' }]);
      expect(repo.entityManager).toBe(fakeManager);
      expect(txQuery).toHaveBeenCalledTimes(1);
      expect(originalQuery).toHaveBeenCalledTimes(1);
    });
  });
});
