import { EntityManager } from 'typeorm';
import { IPagedData, IPageParams } from '@onivoro/server-typeorm-common';
import { TypeOrmPagingRepository } from './type-orm-paging-repository.class';
import { TypeOrmRepository } from './type-orm-repository.class';

type TThing = { id: number; name?: string };
type TThingParams = { name?: string; city?: string };

class ThingEntity {}

class ThingRepository extends TypeOrmPagingRepository<TThing, TThingParams> {
  constructor(entityManager: EntityManager) {
    super(ThingEntity, entityManager);
  }

  async getPage(
    { pageSize, pagingKey }: IPageParams,
    params: TThingParams,
  ): Promise<IPagedData<TThing>> {
    const skip = this.getSkip(pagingKey, pageSize);
    const where = this.removeFalseyKeys(params);
    const [data, total] = await this.getManyAndCount({
      where,
      skip,
      take: pageSize,
    });
    return {
      data,
      total,
      pageSize,
      pagingKey: this.getPagingKey(pageSize, skip, total) as number,
    };
  }
}

describe(TypeOrmPagingRepository.name + ' (postgres)', () => {
  function setup(rows: TThing[], total: number) {
    const findAndCount = jest.fn().mockResolvedValue([rows, total]);
    const manager = {
      getRepository: jest.fn(() => ({ findAndCount })),
    } as unknown as EntityManager;
    return { findAndCount, repo: new ThingRepository(manager), manager };
  }

  it('is a TypeOrmRepository bound to the entity type and manager', () => {
    const { repo, manager } = setup([], 0);

    expect(repo).toBeInstanceOf(TypeOrmRepository);
    expect(repo.entityType).toBe(ThingEntity);
    expect(repo.entityManager).toBe(manager);
  });

  it('exposes the paging helpers to subclasses', async () => {
    const { repo, findAndCount } = setup([{ id: 11 }], 25);

    const page = await repo.getPage(
      { pageSize: 10, pagingKey: 1 },
      { name: 'x', city: undefined },
    );

    expect(findAndCount).toHaveBeenCalledWith({
      where: { name: 'x' },
      skip: 10,
      take: 10,
    });
    expect(page).toEqual({
      data: [{ id: 11 }],
      total: 25,
      pageSize: 10,
      pagingKey: 2,
    });
  });

  it('returns an undefined paging key on the last page', async () => {
    const { repo } = setup([{ id: 21 }], 25);

    const page = await repo.getPage({ pageSize: 10, pagingKey: 2 }, {});

    expect(page.pagingKey).toBeUndefined();
  });
});
