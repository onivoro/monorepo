import {
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ILike,
  QueryRunner,
} from 'typeorm';

import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IEntityProvider } from '../types/entity-provider.interface';
import { BadRequestException } from '@nestjs/common';
import { ReadStream } from 'fs';

export type TQueryStreamParams<TRecord = any> = {
  query: string,
  onData?: (stream: ReadStream, record: TRecord, count: number) => Promise<any | void>,
  onError?: (stream: ReadStream, error: any) => Promise<any | void>,
  onEnd?: (stream: ReadStream, count: number) => Promise<any | void>,
};

export class TypeOrmRepository<TEntity> implements IEntityProvider<
  TEntity,
  FindOneOptions<TEntity>,
  FindManyOptions<TEntity>,
  FindOptionsWhere<TEntity>,
  QueryDeepPartialEntity<TEntity>
> {
  constructor(private entityType: any, public entityManager: EntityManager) { }

  forTransaction(entityManager: EntityManager): TypeOrmRepository<TEntity> {
    return {...this, entityManager};
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

  async postMany(body: Partial<TEntity | undefined>[]): Promise<TEntity[]> {
    return await this.insertAndReturnMany(body as TEntity[]);
  }

  async delete(options: FindOptionsWhere<TEntity>): Promise<void> {
    return await (this.repo.delete as any)(options);
  }

  async softDelete(options: FindOptionsWhere<TEntity>): Promise<void> {
    return await (this.repo.softDelete as any)(options);
  }

  async put(options: FindOptionsWhere<TEntity>, body: QueryDeepPartialEntity<TEntity>) {
    await this.repo.save(options, body);
  }

  async patch(options: FindOptionsWhere<TEntity>, body: QueryDeepPartialEntity<TEntity>) {
    await this.repo.update(options, body);
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

  static async queryStream<TRecord = any>(queryRunner: QueryRunner, _: TQueryStreamParams) {
    if (!_.query) {
      throw new BadRequestException(`StreamingQueryRunner requires one of: {query, table}`);
    }

    let processedCount = 0;
    const query = _.query;

    try {
      const stream = await queryRunner.stream(query);

      stream.on('data', (record: TRecord) => {
        _.onData?.(stream, record, processedCount++);
      });

      stream.on('error', (error: Error) => {
        console.error({ detail: `Error processing stream for query "${_.query}"`, error });
        _.onError?.(stream, error);
      });

      stream.on('end', () => {
        console.log({ detail: `Finished processing stream for query "${_.query}"`, processedCount });
        _.onEnd?.(stream, processedCount);
      });

      return { stream, error: null };
    } catch (error: any) {
      console.error({ detail: `Error processing stream for query "${_.query}"`, error });
      return { stream: null, error };
    }
  }

  async queryStream<TRecord = any>(_: TQueryStreamParams) {
    const queryRunner = this.entityManager.connection.createQueryRunner();
    return await TypeOrmRepository.queryStream<TRecord>(queryRunner, _);
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
