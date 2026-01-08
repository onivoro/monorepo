import {
  DataSource,
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ILike,
  SaveOptions,
} from 'typeorm';

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IEntityProvider } from '../types/entity-provider.interface';
import { TKeysOf } from '@onivoro/isomorphic-common';
import { TTableMeta } from '../types/table-meta.type';

export class TypeOrmRepository<TEntity> implements IEntityProvider<
  TEntity,
  FindOneOptions<TEntity>,
  FindManyOptions<TEntity>,
  FindOptionsWhere<TEntity>,
  QueryDeepPartialEntity<TEntity>
> {
  columns: TKeysOf<TEntity, TTableMeta> = {} as any;
  table: string;
  schema: string;
  debug = false;

  constructor(public entityType: any, public entityManager: EntityManager) {

    const { tableName, schema } = this.repo.metadata;

    this.table = tableName;
    this.schema = schema!;

    this.repo.metadata.columns.forEach((_) => {
      const { databasePath, propertyPath, type, isPrimary } = _;
      this.columns[propertyPath as keyof TEntity] = { databasePath, type, propertyPath, isPrimary, default: _.default };
    })
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
    return (await this.insertAndReturnMany(body as TEntity[])) as  any;
  }

  async delete(options: FindOptionsWhere<TEntity>): Promise<void> {
    return await (this.repo.delete as any)(options);
  }

  async softDelete(options: FindOptionsWhere<TEntity>): Promise<void> {
    return await (this.repo.softDelete as any)(options);
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

  get repo() {
    return this.entityManager.getRepository(this.entityType as any);
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
    const queryParams: any[] = [];
    let whereClause = '';

    Object.entries(where || {}).forEach(([propertyPath, value], index) => {
      const key = this.columns[propertyPath as keyof TEntity].databasePath;

      const where = Array.isArray((value as any).value)
        ? `${key} = ANY($${index + 1})`
        : `${key} = $${index + 1}`;

      if (index === 0) {
        whereClause += ` WHERE ${where}`;
      } else {
        whereClause += ` AND ${where}`;
      }
      queryParams.push(value);
    });

    return { queryParams, whereClause };
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

  static buildFromMetadata<TGenericEntity>(dataSource: DataSource, _: {schema: string, table: string, columns: TKeysOf<TGenericEntity, TTableMeta>}) {

    class GenericRepository extends TypeOrmRepository<TGenericEntity> {
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

    return genericRepository as TypeOrmRepository<TGenericEntity>;
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
