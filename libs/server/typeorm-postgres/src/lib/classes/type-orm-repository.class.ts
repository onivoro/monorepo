import {
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ILike,
  ObjectLiteral,
  SaveOptions,
} from 'typeorm';

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IEntityProvider } from '@onivoro/server-typeorm-common';
import { TKeysOf } from '@onivoro/isomorphic-common';
import { TTableMeta } from '../types/table-meta.type';
import { buildWhereExpression as buildWhereExpressionFn } from '../functions/build-where-expression.function';

type TMetaSnapshot = { table: string; schema: string; columns: Record<string, TTableMeta> };

type TGroupByOptions<TEntity extends ObjectLiteral, TReturn extends ObjectLiteral> = {
  select: Record<keyof TReturn, string>;
  where?: FindOptionsWhere<TEntity>;
  order?: Record<keyof TReturn, 'ASC' | 'DESC'>;
  groupBy: (keyof TEntity)[];
}

export class TypeOrmRepository<TEntity extends ObjectLiteral> implements IEntityProvider<
  TEntity,
  FindOneOptions<TEntity>,
  FindManyOptions<TEntity>,
  FindOptionsWhere<TEntity>,
  QueryDeepPartialEntity<TEntity>
> {
  debug = false;

  private static readonly _metaCache = new WeakMap<Function, TMetaSnapshot>();
  private _meta?: TMetaSnapshot;

  constructor(public entityType: EntityTarget<TEntity>, public entityManager: EntityManager) { }

  get columns(): TKeysOf<TEntity, TTableMeta> {
    return this._ensureMeta().columns as TKeysOf<TEntity, TTableMeta>;
  }

  get table(): string {
    return this._ensureMeta().table;
  }

  get schema(): string {
    return this._ensureMeta().schema;
  }

  private _ensureMeta(): TMetaSnapshot {
    if (this._meta) return this._meta;
    const entityCtor = this.repo.metadata.target as Function;
    let cached = TypeOrmRepository._metaCache.get(entityCtor);
    if (!cached) {
      const meta = this.repo.metadata;
      const columns: Record<string, TTableMeta> = {};
      meta.columns.forEach((c) => {
        columns[c.propertyPath] = {
          databasePath: c.databasePath,
          type: c.type,
          propertyPath: c.propertyPath,
          isPrimary: c.isPrimary,
          default: c.default,
        };
      });
      cached = { table: meta.tableName, schema: meta.schema ?? '', columns };
      TypeOrmRepository._metaCache.set(entityCtor, cached);
    }
    this._meta = cached;
    return cached;
  }

  forTransaction(entityManager: EntityManager): TypeOrmRepository<TEntity> {
    return new (this.constructor as typeof TypeOrmRepository<TEntity>)(this.entityType, entityManager);
  }

  async getMany(options: FindManyOptions<TEntity>): Promise<TEntity[]> {
    return await (this.repo.find as any)(options);
  }

  async getManyAndCount(options: FindManyOptions<TEntity>): Promise<[TEntity[], number]> {
    return await (this.repo.findAndCount as any)(options);
  }

  async getOne(options: FindOneOptions<TEntity>): Promise<TEntity> {
    const results = await this.getMany(options);

    if (results?.length > 1) {
      throw new Error(`${TypeOrmRepository.prototype.getOne.name} expects only 1 result but found ${results.length} results of entity type "${this.entityType}" for criteria ${JSON.stringify(options, null, 2)}`);
    }

    return results[0];
  }

  async postOne(body: Partial<TEntity>): Promise<TEntity> {
    return await this.insertAndReturn(body as TEntity);
  }

  async postMany(body: Partial<TEntity>[]): Promise<TEntity[]> {
    return this.insertAndReturnMany(body as TEntity[]);
  }

  async delete(options: FindOptionsWhere<TEntity>): Promise<void> {
    await this.repo.delete(options);
  }

  async softDelete(options: FindOptionsWhere<TEntity>): Promise<void> {
    await this.repo.softDelete(options);
  }

  put<T extends DeepPartial<TEntity>>(entities: T[], options: SaveOptions & { reload: false }): Promise<T[]>;
  put<T extends DeepPartial<TEntity>>(entities: T[], options?: SaveOptions): Promise<(T & TEntity)[]>;
  put<T extends DeepPartial<TEntity>>(entity: T, options: SaveOptions & { reload: false }): Promise<T>;
  put<T extends DeepPartial<TEntity>>(entity: T, options?: SaveOptions): Promise<T & TEntity>;
  async put<T extends DeepPartial<TEntity>>(entityOrEntities: T | T[], options?: SaveOptions): Promise<T | T[] | (T & TEntity) | (T & TEntity)[]> {
    return await this.repo.save(entityOrEntities as any, options);
  }

  async patch(options: FindOptionsWhere<TEntity>, body: QueryDeepPartialEntity<TEntity>) {
    await this.repo.update(options, body);
  }

  async head(options: FindOptionsWhere<TEntity>, withDeleted = true): Promise<boolean> {
    return await this.repo.exists({ where: options, withDeleted });
  }

  async getManyGroupedBy<TReturn extends ObjectLiteral>(options: TGroupByOptions<TEntity, TReturn>): Promise<TReturn[]> {
    const queryBuilder = await this.repo.createQueryBuilder();
    const selectEntries = Object.entries(options.select);
    for (let index = 0; index < selectEntries.length; index++) {
      const [selectKey, selectValue] = selectEntries[index];
      if (index === 0) {
        queryBuilder.select(selectValue as any, selectKey);
      } else {
        queryBuilder.addSelect(selectValue as any, selectKey);
      }
    }
    if (options.where) {
      queryBuilder.where(options.where);
    }
    if (options.order) {
      for (const [orderKey, orderValue] of Object.entries(options.order)) {
        queryBuilder.addOrderBy(orderKey, orderValue);
      }
    }
    options.groupBy.forEach(group => {
      queryBuilder.addGroupBy(group as string);
    });
    return await queryBuilder.getRawMany() as TReturn[];
  }

  get repo() {
    return this.entityManager.getRepository(this.entityType);
  }

  protected async insertAndReturn(entityToInsert: TEntity): Promise<TEntity> {
    return (await this.insertAndReturnMany([entityToInsert]))[0];
  }

  protected async insertAndReturnMany(entitiesToInsert: TEntity[]): Promise<TEntity[]> {
    const insertionResult = await this.repo
      .createQueryBuilder()
      .insert()
      .values(entitiesToInsert)
      .returning('*')
      .execute();

    const insertedEntity: TEntity[] =
      insertionResult.generatedMaps as TEntity[];

    return insertedEntity;
  }

  protected getSchemaPrefix() {
    return this.schema ? `"${this.schema}".` : '';
  }

  protected getTableNameExpression() {
    const schemaPrefix = this.getSchemaPrefix();
    return `${schemaPrefix}"${this.table}"`;
  }

  protected buildSelectStatement(options: FindManyOptions<TEntity>): { query: string; queryParams: any[]; } {
    const { whereClause, queryParams } = this.buildWhereExpression(options.where as FindOptionsWhere<TEntity>);
    const query = `SELECT * FROM ${this.getTableNameExpression()}${whereClause};`;
    return { query, queryParams };
  }

  protected buildDeleteStatement(where: FindManyOptions<TEntity>): { query: string; queryParams: any[]; } {
    const { whereClause, queryParams } = this.buildWhereExpression(where as FindOptionsWhere<TEntity>);
    const query = `DELETE FROM ${this.getTableNameExpression()}${whereClause};`;
    return { query, queryParams };
  }

  protected buildWhereExpression(where?: FindOptionsWhere<TEntity>) {
    return buildWhereExpressionFn(where as any, this.columns as any);
  }

  protected buildInsertQuery(entity: Partial<TEntity>): { insertQuery: string, values: any[] } {
    const keys: Array<keyof TEntity> = Object.keys(entity) as any;
    const values = Object.values(entity);

    const columnNames = keys.map(key => this.columns[key].databasePath).join(', ');
    const paramPlaceholders = keys.map((key, index) => this.mapPlaceholderExpression(0, index, key as string)).join(', ');

    const insertQuery = `INSERT INTO ${this.getTableNameExpression()} (${columnNames}) VALUES (${paramPlaceholders})`;

    return { insertQuery, values };
  }

  protected buildInsertManyQuery(entities: Partial<TEntity>[]): { insertQuery: string, values: any[] } {
    const keyMap: Record<keyof TEntity, boolean> = {} as any;

    entities.forEach(entity => {
      (Object.keys(entity) as Array<keyof TEntity>)
        .forEach(key => {
          keyMap[key] = true;
        });
    });

    const columnNames = (Object.keys(keyMap) as Array<keyof TEntity>).map(key => this.columns[key].databasePath).join(', ');

    const valuesExpressions: string[] = [];
    const values: any[] = [];

    entities.forEach(entity => {
      const length = values.length;

      (Object.keys(keyMap) as Array<keyof TEntity>).forEach((key) => {
        values.push((typeof entity[key] === 'undefined') ? this.columns[key].default : entity[key]);
      });

      const paramPlaceholders = Object.keys(keyMap).map((_, index) => this.mapPlaceholderExpression(length, index, _)).join(', ');

      valuesExpressions.push(`(${paramPlaceholders})`);
    });

    const insertQuery = `INSERT INTO ${this.getTableNameExpression()} (${columnNames}) VALUES ${valuesExpressions.join(', ')}`;

    return { insertQuery, values };
  }

  protected mapPlaceholderExpression(length: number, index: number, column: string) {
    const exp = `$${length + index + 1}`;

    const meta: TTableMeta = this.columns[column as keyof TEntity];
    return meta.type === 'jsonb' ? exp : exp; // TODO: figure out how to handle this for postgres... $1::jsonb equivalent
  }

  protected buildSelectManyQuery(entities: Partial<TEntity>[]): { selectQuery: string, values: any[] } {
    const keyMap: any = {};

    entities.forEach(entity => {
      Object.keys(entity)
        .forEach(key => {
          keyMap[key] = true;
        });
    });

    const selectExpressions: string[] = [];
    const values: any[] = [];

    entities.forEach(entity => {
      const length = values.length;

      (Object.keys(keyMap) as Array<keyof Partial<TEntity>>).forEach(key => {
        values.push((typeof entity[key] === 'undefined') ? this.columns[key].default : entity[key]);
      });

      const whereExpression = Object.keys(keyMap).map((_, index) => `(${(this.columns as any)[_].databasePath} = $${length + index + 1})`).join(' AND ');

      selectExpressions.push(`(select * from ${this.getTableNameExpression()} where (${whereExpression}))`);
    });

    const selectQuery = selectExpressions.join(' UNION ');

    return { selectQuery, values };
  }

  map(raw: any): TEntity {
    const mapped = (Object.values(this.columns) as TTableMeta[])
      .reduce((entity: any, { propertyPath, databasePath }: TTableMeta) => {
        entity[propertyPath] = raw[databasePath];
        return entity;
      }, {} as any) as TEntity;

    return mapped;
  }

  async query(query: string, parameters: any[]) {
    if (this.debug) {
      console.log({ schema: this.schema, table: this.table, query, parameters });
    }

    const result = await this.repo.query(query, parameters);

    if (this.debug) {
      console.log({ schema: this.schema, table: this.table, query, parameters, result });
    }

    return result as any[];
  }

  async queryAndMap(query: string, parameters: any[]) {
    const result = await this.query(query, parameters);

    return result?.map((_: any) => this.map(_)) as TEntity[];
  }

  buildWhereILike(filters?: Record<string, any>): FindOptionsWhere<TEntity> {

    if(!filters) {
      return {};
    }

    return Object.entries(filters || {})
      .reduce(
        (_, [column, filter]) => (
          filter
            ? { ..._, [column]: ILike(`%${filter}%`) }
            : _
        ),
        {}
      ) as any;
  }
}
