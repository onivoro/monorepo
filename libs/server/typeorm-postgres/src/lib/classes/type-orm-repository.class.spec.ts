import { EntityManager, ILike } from 'typeorm';
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
  const metadataColumns = Object.entries(columnsSpec).map(([propertyPath, c]) => ({
    propertyPath,
    databasePath: c.databasePath,
    type: c.type ?? 'varchar',
    isPrimary: c.isPrimary ?? false,
    default: c.default,
  }));
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
      const { fakeManager, EntityClass } = buildFixture('users', 'public', { id: { databasePath: 'id' } }, { find });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      expect(await repo.getOne({ where: { id: 'x' } })).toBeUndefined();
    });

    it('returns the single row when find returns one', async () => {
      const find = jest.fn().mockResolvedValue([{ id: 'x' }]);
      const { fakeManager, EntityClass } = buildFixture('users', 'public', { id: { databasePath: 'id' } }, { find });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      expect(await repo.getOne({ where: { id: 'x' } })).toEqual({ id: 'x' });
    });

    it('throws with a descriptive error when find returns >1', async () => {
      const find = jest.fn().mockResolvedValue([{ id: 'x' }, { id: 'y' }]);
      const { fakeManager, EntityClass } = buildFixture('users', 'public', { id: { databasePath: 'id' } }, { find });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      await expect(repo.getOne({ where: {} })).rejects.toThrow(
        /getOne expects only 1 result but found 2 results/,
      );
    });
  });

  describe('getTableNameExpression', () => {
    it('includes a quoted schema prefix when schema is set', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', { id: { databasePath: 'id' } });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      expect((repo as any).getTableNameExpression()).toBe('"public"."users"');
    });

    it('omits the schema prefix when schema is empty', () => {
      const { fakeManager, EntityClass } = buildFixture('users', '', { id: { databasePath: 'id' } });
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
      const result = (repo as any).buildInsertQuery({ id: 'u1', email: 'a@b.com' });
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
      expect(result.values).toEqual(['u1', 'a@b.com', 'active', 'u2', undefined, 'banned']);
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
      const { fakeManager, EntityClass } = buildFixture('users', 'public', { id: { databasePath: 'id' } });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      expect(repo.buildWhereILike(undefined)).toEqual({});
    });

    it('drops falsy filter values and wraps truthy ones in ILike(%...%)', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', {
        id: { databasePath: 'id' },
        email: { databasePath: 'email_address' },
      });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      const result = repo.buildWhereILike({ email: 'a@b', id: undefined, other: '' });
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
      expect(repo.map({ id: 'u1', email_address: 'a@b.com', extra: 'ignored' })).toEqual({
        id: 'u1',
        email: 'a@b.com',
      });
    });
  });

  describe('forTransaction', () => {
    it('returns a new instance bound to the provided EntityManager', () => {
      const { fakeManager, EntityClass } = buildFixture('users', 'public', { id: { databasePath: 'id' } });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      const other = { getRepository: jest.fn(() => ({ metadata: { target: EntityClass, columns: [], tableName: 'users', schema: 'public' } })) } as unknown as EntityManager;
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
      const { fakeManager, EntityClass } = buildFixture('users', 'public', { id: { databasePath: 'id' } }, { exists });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      await repo.head({ id: 'x' } as any);
      expect(exists).toHaveBeenCalledWith({ where: { id: 'x' }, withDeleted: true });
    });

    it('passes withDeleted=false through when explicitly set', async () => {
      const exists = jest.fn().mockResolvedValue(false);
      const { fakeManager, EntityClass } = buildFixture('users', 'public', { id: { databasePath: 'id' } }, { exists });
      const repo = new TypeOrmRepository<any>(EntityClass, fakeManager);
      await repo.head({ id: 'x' } as any, false);
      expect(exists).toHaveBeenCalledWith({ where: { id: 'x' }, withDeleted: false });
    });
  });
});
