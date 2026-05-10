import { EntityManager } from 'typeorm';
import { TypeOrmRepository } from './type-orm-repository.class';

function fakeManager(overrides: {
  find?: jest.Mock;
  save?: jest.Mock;
  exists?: jest.Mock;
  findAndCount?: jest.Mock;
} = {}): EntityManager {
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
      const repo = new TypeOrmRepository<any>(FakeEntity, fakeManager({ find }));
      expect(await repo.getOne({})).toBeUndefined();
    });

    it('returns the single row when find returns one', async () => {
      const find = jest.fn().mockResolvedValue([{ id: 1 }]);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(FakeEntity, fakeManager({ find }));
      expect(await repo.getOne({})).toEqual({ id: 1 });
    });

    it('throws with a descriptive error when find returns >1', async () => {
      const find = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(FakeEntity, fakeManager({ find }));
      await expect(repo.getOne({})).rejects.toThrow(
        /getOne expects only 1 result but found 2 results/,
      );
    });
  });

  describe('head', () => {
    it('calls exists with withDeleted=true by default', async () => {
      const exists = jest.fn().mockResolvedValue(true);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(FakeEntity, fakeManager({ exists }));
      await repo.head({ id: 1 } as any);
      expect(exists).toHaveBeenCalledWith({ where: { id: 1 }, withDeleted: true });
    });

    it('passes withDeleted=false through when explicitly set', async () => {
      const exists = jest.fn().mockResolvedValue(false);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(FakeEntity, fakeManager({ exists }));
      await repo.head({ id: 1 } as any, false);
      expect(exists).toHaveBeenCalledWith({ where: { id: 1 }, withDeleted: false });
    });
  });

  describe('postOne / postMany', () => {
    it('postOne calls repo.save with the body and returns what save returned', async () => {
      const save = jest.fn().mockResolvedValue({ id: 1 });
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(FakeEntity, fakeManager({ save }));
      expect(await repo.postOne({ name: 'x' })).toEqual({ id: 1 });
      expect(save).toHaveBeenCalledWith({ name: 'x' });
    });

    it('postMany calls repo.save with the array', async () => {
      const save = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const FakeEntity = class {};
      const repo = new TypeOrmRepository<any>(FakeEntity, fakeManager({ save }));
      expect(await repo.postMany([{ n: 1 }, { n: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
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
});
