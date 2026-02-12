import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  SaveOptions,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TypeOrmRepository } from './type-orm-repository.class';
import { TTableMeta } from '../types/table-meta.type';
import { TKeysOf } from '@onivoro/isomorphic-common';

@Injectable()
export class RedshiftRepository<TEntity extends ObjectLiteral> extends TypeOrmRepository<TEntity> {
  constructor(public entityType: EntityTarget<TEntity>, public entityManager: EntityManager) {
    super(entityType, entityManager);
  }

  override async getMany(options: FindManyOptions<TEntity>): Promise<TEntity[]> {
    const { query, queryParams } = this.buildSelectStatement(options);

    return await this.queryAndMap(query, queryParams.map(_ => (_ as any).value ? (_ as any).value : _));
  }

  override async getOne(options: FindOneOptions<TEntity>): Promise<TEntity> {
    const results = await this.getMany(options);

    if (results.length > 1) {
      throw new Error(`RedshiftRepository.getOne expected one result but found ${results.length} results`);
    }

    return results[0];
  }

  override async delete(where: FindOptionsWhere<TEntity>): Promise<void> {
    const { query, queryParams } = this.buildDeleteStatement(where);

    await this.query(query, queryParams);
  }

  override async patch(where: FindOptionsWhere<TEntity>, body: QueryDeepPartialEntity<TEntity>): Promise<void> {
    const queryParams: any[] = [];
    let whereClause = '';

    Object.entries(where).forEach(([propertyPath, value], index) => {
      const key = this.columns[propertyPath as keyof TEntity].databasePath;
      if (index === 0) {
        whereClause += ` WHERE ${key} = ${this.mapPlaceholderExpression(0, index, propertyPath)}`;
      } else {
        whereClause += ` AND ${key} = ${this.mapPlaceholderExpression(0, index, propertyPath)}`;
      }
      queryParams.push(value);
    });

    const setParams: any[] = [];
    let setExpressions: string[] = [];

    const length = queryParams?.length;

    Object.entries(body).forEach(([key, value], index) => {
      setExpressions.push(`${this.columns[key as keyof TEntity].databasePath} = ${this.mapPlaceholderExpression(length, index, key)}`);
      setParams.push(value);
    });

    let query = `UPDATE ${this.getTableNameExpression()} SET ${setExpressions.join(', ')} ${whereClause}`;

    await this.query(query, [...queryParams, ...setParams]);
  }

  override async postOne(entity: Partial<TEntity>): Promise<TEntity> {
    await this.postOneWithoutReturn(entity);

    return await this.getOne({ where: entity as any });
  }

  override async postMany(entities: Partial<TEntity>[]): Promise<TEntity[]> {
    if (entities?.length) {
      const { insertQuery, values } = this.buildInsertManyQuery(entities);

      await this.query(insertQuery, values);

      const { selectQuery, values: selectValues } = this.buildSelectManyQuery(entities);

      return await this.queryAndMap(selectQuery, selectValues);
    }

    return [];
  }

  override put<T extends DeepPartial<TEntity>>(entities: T[], options: SaveOptions & { reload: false }): Promise<T[]>;
  override put<T extends DeepPartial<TEntity>>(entities: T[], options?: SaveOptions): Promise<(T & TEntity)[]>;
  override put<T extends DeepPartial<TEntity>>(entity: T, options: SaveOptions & { reload: false }): Promise<T>;
  override put<T extends DeepPartial<TEntity>>(entity: T, options?: SaveOptions): Promise<T & TEntity>;
  override async put<T extends DeepPartial<TEntity>>(entityOrEntities: T | T[], options?: SaveOptions): Promise<T | T[] | (T & TEntity) | (T & TEntity)[]> {
    this.throwNotImplemented('put');
    return entityOrEntities as any;
  }

  async head(options: FindOptionsWhere<TEntity>, withDeleted = true): Promise<boolean> {
    this.throwNotImplemented('head');
    return undefined as any;
  }

  override forTransaction(entityManager: EntityManager): TypeOrmRepository<TEntity> {
    this.throwNotImplemented('forTransaction');
    return this;
  }

  override async getManyAndCount(options: FindManyOptions<TEntity>): Promise<[TEntity[], number]> {
    this.throwNotImplemented('getManyAndCount');
    return [[], 0];
  }

  override async softDelete(where: FindOptionsWhere<TEntity>): Promise<void> {
    await this.patch(where, { deletedAt: new Date().toISOString() } as any);
  }

  async postOneWithoutReturn(entity: Partial<TEntity>): Promise<void> {
    // PERFORM AN INSERT BUT NOT THE RETRIEVAL QUERY FOR PERFORMANCE
    const { insertQuery, values } = this.buildInsertQuery(entity);

    await this.query(insertQuery, values);
  }

  async postManyWithoutReturn(entities: Partial<TEntity>[]): Promise<void> {
    // TODO: PERFORM AN INSERT BUT NOT THE RETRIEVAL QUERY FOR PERFORMANCE
    // TODO: THIS IS ACTUALLY NEEDED TO HELP WITH LARGE DATASETS
    this.throwNotImplemented('postManyWithoutReturn');
  }

  private throwNotImplemented(feature: string) {
    throw new NotImplementedException(`RedshiftRepository of type "${this.entityType}" has no implementation for "${feature}"`);
  }

  protected override mapPlaceholderExpression(length: number, index: number, column: string) {
    const exp = `$${length + index + 1}`;
    const meta: TTableMeta = this.columns[column as keyof TEntity];
    return meta.type === 'jsonb' ? `JSON_PARSE(${exp})` : exp;
  }

  static buildFromMetadata<TGenericEntity extends ObjectLiteral>(dataSource: DataSource, _: {schema: string, table: string, columns: TKeysOf<TGenericEntity, TTableMeta>}) {

      class GenericRepository extends RedshiftRepository<TGenericEntity> {
        constructor() {
          const entityManager = dataSource.createEntityManager();
          super(Object, {
            ...entityManager,
            getRepository: () => entityManager as any
          } as any);
        }
      }

      const genericRepository = new GenericRepository();
      (genericRepository as any).schema = _.schema;
      (genericRepository as any).table = _.table;
      (genericRepository as any).columns = _.columns;

      return genericRepository as RedshiftRepository<TGenericEntity>;
    }
}
