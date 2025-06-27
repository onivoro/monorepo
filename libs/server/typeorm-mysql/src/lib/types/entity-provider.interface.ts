export interface IEntityProvider<TEntity, TFindOneOptions, TFindManyOptions, TFindOptionsWhere, TQueryDeepPartialEntity> {
    getOne: (options: TFindOneOptions) => Promise<TEntity>;
    getMany: (options: TFindManyOptions) => Promise<TEntity[]>;
    postOne: (body: Partial<TEntity>) => Promise<TEntity>;
    postMany: (body: Partial<TEntity[]>) => Promise<TEntity[]>;
    delete: (options: TFindOptionsWhere) => Promise<void>;
    put: (options: TFindOptionsWhere, body: TQueryDeepPartialEntity) => Promise<void>;
    patch: (options: TFindOptionsWhere, body: TQueryDeepPartialEntity) => Promise<void>;
}