import { EventEmitter } from 'events';
import { BadRequestException } from '@nestjs/common';
import { EntityManager, FindOperator, QueryRunner } from 'typeorm';
import { TypeOrmRepository } from './type-orm-repository.class';

function fakeManager(
  overrides: {
    find?: jest.Mock;
    save?: jest.Mock;
    exists?: jest.Mock;
    findAndCount?: jest.Mock;
  } = {},
): EntityManager {
  return {
    getRepository: jest.fn(() => ({
      find: overrides.find ?? jest.fn(),
      save: overrides.save ?? jest.fn(),
      exists: overrides.exists ?? jest.fn(),
      delete: jest.fn(),
      softDelete: jest.fn(),
      update: jest.fn(),
      findAndCount: overrides.findAndCount ?? jest.fn(),
    })),
  } as unknown as EntityManager;
}

describe(TypeOrmRepository.name + ' (mysql)', () => {
  describe('getOne', () => {
    it('returns undefined when find returns []', async () => {
      const find = jest.fn().mockResolvedValue([]);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(
        FakeEntity,
        fakeManager({ find }),
      );
      expect(await repo.getOne({})).toBeUndefined();
    });

    it('returns the single row when find returns one', async () => {
      const find = jest.fn().mockResolvedValue([{ id: 1 }]);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(
        FakeEntity,
        fakeManager({ find }),
      );
      expect(await repo.getOne({})).toEqual({ id: 1 });
    });

    it('throws with a descriptive error when find returns >1', async () => {
      const find = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(
        FakeEntity,
        fakeManager({ find }),
      );
      await expect(repo.getOne({})).rejects.toThrow(
        /getOne expects only 1 result but found 2 results/,
      );
    });
  });

  describe('head', () => {
    it('calls exists with withDeleted=true by default', async () => {
      const exists = jest.fn().mockResolvedValue(true);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(
        FakeEntity,
        fakeManager({ exists }),
      );
      await repo.head({ id: 1 } as any);
      expect(exists).toHaveBeenCalledWith({
        where: { id: 1 },
        withDeleted: true,
      });
    });

    it('passes withDeleted=false through when explicitly set', async () => {
      const exists = jest.fn().mockResolvedValue(false);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(
        FakeEntity,
        fakeManager({ exists }),
      );
      await repo.head({ id: 1 } as any, false);
      expect(exists).toHaveBeenCalledWith({
        where: { id: 1 },
        withDeleted: false,
      });
    });
  });

  describe('postOne / postMany', () => {
    it('postOne calls repo.save with the body and returns what save returned', async () => {
      const save = jest.fn().mockResolvedValue({ id: 1 });
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(
        FakeEntity,
        fakeManager({ save }),
      );
      expect(await repo.postOne({ name: 'x' })).toEqual({ id: 1 });
      expect(save).toHaveBeenCalledWith({ name: 'x' });
    });

    it('postMany calls repo.save with the array', async () => {
      const save = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(
        FakeEntity,
        fakeManager({ save }),
      );
      expect(await repo.postMany([{ n: 1 }, { n: 2 }])).toEqual([
        { id: 1 },
        { id: 2 },
      ]);
      expect(save).toHaveBeenCalledWith([{ n: 1 }, { n: 2 }]);
    });
  });

  describe('forTransaction', () => {
    it('returns a new instance bound to the provided EntityManager', () => {
      const FakeEntity = class {};
      const mgr1 = fakeManager();
      const mgr2 = fakeManager();
      const repo = new TypeOrmRepository<any>(FakeEntity, mgr1);
      const forked = repo.forTransaction(mgr2);
      expect(forked).not.toBe(repo);
      expect(forked).toBeInstanceOf(TypeOrmRepository);
      expect(forked.entityManager).toBe(mgr2);
      expect(forked.entityType).toBe(FakeEntity);
    });
  });

  describe('pass-through methods', () => {
    function managerWithRepo() {
      const repo = {
        find: jest.fn().mockResolvedValue([{ id: 1 }]),
        findAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        save: jest.fn(async (x: any) => x),
      };
      const manager = {
        getRepository: jest.fn(() => repo),
      } as unknown as EntityManager;
      return { repo, manager };
    }

    const FakeEntity = class {};

    it('repo resolves the repository for the entity type from the entity manager', () => {
      const { repo, manager } = managerWithRepo();
      const subject = new TypeOrmRepository<any>(FakeEntity, manager);

      expect(subject.repo).toBe(repo);
      expect(manager.getRepository).toHaveBeenCalledWith(FakeEntity);
    });

    it('getMany delegates to find', async () => {
      const { repo, manager } = managerWithRepo();
      const options = { where: { id: 1 } };

      expect(
        await new TypeOrmRepository<any>(FakeEntity, manager).getMany(options),
      ).toEqual([{ id: 1 }]);
      expect(repo.find).toHaveBeenCalledWith(options);
    });

    it('getManyAndCount delegates to findAndCount', async () => {
      const { repo, manager } = managerWithRepo();
      const options = { take: 1 };

      expect(
        await new TypeOrmRepository<any>(FakeEntity, manager).getManyAndCount(
          options,
        ),
      ).toEqual([[{ id: 1 }], 1]);
      expect(repo.findAndCount).toHaveBeenCalledWith(options);
    });

    it('delete and softDelete delegate with the criteria', async () => {
      const { repo, manager } = managerWithRepo();
      const subject = new TypeOrmRepository<any>(FakeEntity, manager);

      await subject.delete({ id: 1 });
      await subject.softDelete({ id: 2 });

      expect(repo.delete).toHaveBeenCalledWith({ id: 1 });
      expect(repo.softDelete).toHaveBeenCalledWith({ id: 2 });
    });

    it('put saves one or many entities with options', async () => {
      const { repo, manager } = managerWithRepo();
      const subject = new TypeOrmRepository<any>(FakeEntity, manager);

      expect(await subject.put({ id: 1 })).toEqual({ id: 1 });
      expect(
        await subject.put([{ id: 1 }, { id: 2 }], { reload: false }),
      ).toEqual([{ id: 1 }, { id: 2 }]);
      expect(repo.save).toHaveBeenNthCalledWith(1, { id: 1 }, undefined);
      expect(repo.save).toHaveBeenNthCalledWith(2, [{ id: 1 }, { id: 2 }], {
        reload: false,
      });
    });

    it('patch updates by criteria and resolves undefined', async () => {
      const { repo, manager } = managerWithRepo();

      await expect(
        new TypeOrmRepository<any>(FakeEntity, manager).patch(
          { id: 1 },
          { name: 'y' },
        ),
      ).resolves.toBeUndefined();
      expect(repo.update).toHaveBeenCalledWith({ id: 1 }, { name: 'y' });
    });

    it('getOne propagates find errors', async () => {
      const find = jest.fn().mockRejectedValue(new Error('db down'));
      const repo = new TypeOrmRepository<any>(
        FakeEntity,
        fakeManager({ find }),
      );

      await expect(repo.getOne({})).rejects.toThrow('db down');
    });
  });

  describe('buildWhereILike', () => {
    const repo = new TypeOrmRepository<any>(class {}, fakeManager());

    it('returns {} when no filters are given', () => {
      expect(repo.buildWhereILike()).toEqual({});
    });

    it('wraps truthy filters in ILike %value% and drops falsy ones', () => {
      const where = repo.buildWhereILike({
        name: 'ann',
        email: '',
        city: undefined,
        zip: 0,
      }) as any;

      expect(Object.keys(where)).toEqual(['name']);
      expect(where.name).toBeInstanceOf(FindOperator);
      expect(where.name.type).toBe('ilike');
      expect(where.name.value).toBe('%ann%');
    });
  });

  describe('queryStream', () => {
    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    function runnerWith(stream: EventEmitter) {
      return {
        stream: jest.fn().mockResolvedValue(stream),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as QueryRunner;
    }

    it('throws BadRequestException when no query is given', async () => {
      await expect(
        TypeOrmRepository.queryStream(runnerWith(new EventEmitter()), {
          query: '',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('streams records to onData with a running count, then calls onEnd with the total', async () => {
      const stream = new EventEmitter();
      const queryRunner = runnerWith(stream);
      const onData = jest.fn();
      const onEnd = jest.fn();

      const result = await TypeOrmRepository.queryStream(queryRunner, {
        query: 'SELECT 1',
        onData,
        onEnd,
      });

      expect(queryRunner.stream).toHaveBeenCalledWith('SELECT 1');
      expect(result).toEqual({ stream, error: null });

      stream.emit('data', { a: 1 });
      stream.emit('data', { a: 2 });
      stream.emit('end');

      expect(onData).toHaveBeenNthCalledWith(1, stream, { a: 1 }, 0);
      expect(onData).toHaveBeenNthCalledWith(2, stream, { a: 2 }, 1);
      expect(onEnd).toHaveBeenCalledWith(stream, 2);
    });

    it('forwards stream errors to onError', async () => {
      const stream = new EventEmitter();
      const onError = jest.fn();
      await TypeOrmRepository.queryStream(runnerWith(stream), {
        query: 'SELECT 1',
        onError,
      });

      const error = new Error('broken');
      stream.emit('error', error);

      expect(onError).toHaveBeenCalledWith(stream, error);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('tolerates missing callbacks', async () => {
      const stream = new EventEmitter();
      await TypeOrmRepository.queryStream(runnerWith(stream), {
        query: 'SELECT 1',
      });

      expect(() => {
        stream.emit('data', {});
        stream.emit('error', new Error('x'));
        stream.emit('end');
      }).not.toThrow();
    });

    it('returns {stream: null, error} when opening the stream fails', async () => {
      const error = new Error('cannot stream');
      const queryRunner = {
        stream: jest.fn().mockRejectedValue(error),
      } as unknown as QueryRunner;

      await expect(
        TypeOrmRepository.queryStream(queryRunner, { query: 'SELECT 1' }),
      ).resolves.toEqual({ stream: null, error });
    });

    it('instance queryStream creates a query runner from the connection', async () => {
      const stream = new EventEmitter();
      const queryRunner = runnerWith(stream);
      const manager = {
        connection: { createQueryRunner: jest.fn(() => queryRunner) },
      } as unknown as EntityManager;

      const result = await new TypeOrmRepository<any>(
        class {},
        manager,
      ).queryStream({ query: 'SELECT 2' });

      expect(manager.connection.createQueryRunner).toHaveBeenCalledTimes(1);
      expect(queryRunner.stream).toHaveBeenCalledWith('SELECT 2');
      expect(result.stream).toBe(stream);
      expect(queryRunner.release).not.toHaveBeenCalled();
    });

    it.each(['end', 'error', 'close'])(
      'instance queryStream releases the query runner once on %s',
      async (event) => {
        const stream = new EventEmitter();
        stream.on('error', () => undefined);
        const queryRunner = runnerWith(stream);
        const manager = {
          connection: { createQueryRunner: jest.fn(() => queryRunner) },
        } as unknown as EntityManager;

        await new TypeOrmRepository<any>(class {}, manager).queryStream({
          query: 'SELECT 3',
        });
        stream.emit(event, new Error('x'));
        stream.emit('close');

        expect(queryRunner.release).toHaveBeenCalledTimes(1);
      },
    );

    it('instance queryStream releases the query runner when the stream cannot be opened', async () => {
      const queryRunner = {
        stream: jest.fn().mockRejectedValue(new Error('nope')),
        release: jest.fn().mockResolvedValue(undefined),
      } as unknown as QueryRunner;
      const manager = {
        connection: { createQueryRunner: jest.fn(() => queryRunner) },
      } as unknown as EntityManager;

      const result = await new TypeOrmRepository<any>(
        class {},
        manager,
      ).queryStream({ query: 'SELECT 4' });

      expect(result.stream).toBeNull();
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('forTransaction with subclasses', () => {
    it('preserves the subclass when it keeps the (entityType, entityManager) constructor', () => {
      class Entity {}
      class Sub extends TypeOrmRepository<any> {}
      const forked = new Sub(Entity, fakeManager()).forTransaction(
        fakeManager(),
      );

      expect(forked).toBeInstanceOf(Sub);
      expect(forked.entityType).toBe(Entity);
    });

    it('works for subclasses with a one-argument constructor', () => {
      class Entity {}
      class Sub extends TypeOrmRepository<any> {
        constructor(em: EntityManager) {
          super(Entity, em);
        }
      }
      const mgr = fakeManager();
      const forked = new Sub(fakeManager()).forTransaction(mgr);

      expect(forked).toBeInstanceOf(Sub);
      expect(forked.entityManager).toBe(mgr);
      expect(forked.entityType).toBe(Entity);
    });

    it('binds the fork to the new manager while the original keeps its own', async () => {
      class Entity {}
      class Sub extends TypeOrmRepository<any> {
        constructor(em: EntityManager) {
          super(Entity, em);
        }
      }
      const originalFind = jest.fn().mockResolvedValue([{ id: 1 }]);
      const txFind = jest.fn().mockResolvedValue([{ id: 2 }]);
      const originalManager = fakeManager({ find: originalFind });
      const txManager = fakeManager({ find: txFind });
      const repo = new Sub(originalManager);
      const forked = repo.forTransaction(txManager);

      expect(await forked.getMany({})).toEqual([{ id: 2 }]);
      expect(await repo.getMany({})).toEqual([{ id: 1 }]);
      expect(txManager.getRepository).toHaveBeenCalledWith(Entity);
      expect(repo.entityManager).toBe(originalManager);
      expect(txFind).toHaveBeenCalledTimes(1);
      expect(originalFind).toHaveBeenCalledTimes(1);
    });
  });
});
