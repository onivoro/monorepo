import {
  EntityManager,
  EntityTarget,
  ObjectLiteral,
} from 'typeorm';

import { TypeOrmRepository } from './type-orm-repository.class';
import { IPagedData, IPageParams, getPagingKey, getSkip, removeFalseyKeys } from '@onivoro/server-typeorm-common';

export abstract class TypeOrmPagingRepository<TEntity extends ObjectLiteral, TEntityParams> extends TypeOrmRepository<TEntity> {
  protected getPagingKey = getPagingKey;
  protected getSkip = getSkip;
  protected removeFalseyKeys = removeFalseyKeys;

  constructor(entityType: EntityTarget<TEntity>, entityManager: EntityManager) {
    super(entityType, entityManager);
  }

  abstract getPage(pageParams: IPageParams, params: TEntityParams): Promise<IPagedData<TEntity>>;
}
