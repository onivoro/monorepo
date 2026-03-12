import { DataSourceOptions, Driver, EntityManager, EntityMetadata, EntitySubscriberInterface, EntityTarget, Logger, Migration, MigrationInterface, MongoEntityManager, MongoRepository, NamingStrategyInterface, ObjectLiteral, ObjectType, QueryRunner, ReplicationMode, Repository, TreeRepository, DataSource as TypeOrmDataSource } from 'typeorm';
import { QueryResultCache } from 'typeorm/cache/QueryResultCache';
import { SqljsEntityManager } from 'typeorm/entity-manager/SqljsEntityManager';
import { RelationIdLoader } from 'typeorm/query-builder/RelationIdLoader';
import { RelationLoader } from 'typeorm/query-builder/RelationLoader';

type TLee = TypeOrmDataSource;

export class DataSource implements TLee {
    "@instanceof": symbol;
    name: string;
    options: DataSourceOptions;
    isInitialized: boolean;
    driver: Driver;
    manager: EntityManager;
    namingStrategy: NamingStrategyInterface;
    metadataTableName: string;
    logger: Logger;
    migrations: MigrationInterface[];
    subscribers: EntitySubscriberInterface<any>[];
    entityMetadatas: EntityMetadata[];
    entityMetadatasMap: Map<EntityTarget<any>, EntityMetadata>;
    queryResultCache?: QueryResultCache | undefined;
    relationLoader: RelationLoader;
    relationIdLoader: RelationIdLoader;
    get isConnected(): boolean {
        throw new Error('Method not implemented.');
    }
    get mongoManager(): MongoEntityManager {
        throw new Error('Method not implemented.');
    }
    get sqljsManager(): SqljsEntityManager {
        throw new Error('Method not implemented.');
    }
    setOptions(options: Partial<DataSourceOptions>): this {
        throw new Error('Method not implemented.');
    }
    initialize(): Promise<this> {
        throw new Error('Method not implemented.');
    }
    connect(): Promise<this> {
        throw new Error('Method not implemented.');
    }
    destroy(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    close(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    synchronize(dropBeforeSync?: boolean): Promise<void> {
        throw new Error('Method not implemented.');
    }
    dropDatabase(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    runMigrations(options?: { transaction?: 'all' | 'none' | 'each'; fake?: boolean; }): Promise<Migration[]> {
        throw new Error('Method not implemented.');
    }
    undoLastMigration(options?: { transaction?: 'all' | 'none' | 'each'; fake?: boolean; }): Promise<void> {
        throw new Error('Method not implemented.');
    }
    showMigrations(): Promise<boolean> {
        throw new Error('Method not implemented.');
    }
    hasMetadata(target: EntityTarget<any>): boolean {
        throw new Error('Method not implemented.');
    }
    getMetadata(target: EntityTarget<any>): EntityMetadata {
        throw new Error('Method not implemented.');
    }
    getRepository<Entity extends ObjectLiteral>(target: EntityTarget<Entity>): Repository<Entity> {
        throw new Error('Method not implemented.');
    }
    getTreeRepository<Entity extends ObjectLiteral>(target: EntityTarget<Entity>): TreeRepository<Entity> {
        throw new Error('Method not implemented.');
    }
    getMongoRepository<Entity extends ObjectLiteral>(target: EntityTarget<Entity>): MongoRepository<Entity> {
        throw new Error('Method not implemented.');
    }
    getCustomRepository<T>(customRepository: ObjectType<T>): T {
        throw new Error('Method not implemented.');
    }
    transaction(isolationLevel: unknown, runInTransaction?: unknown): Promise<T> | Promise<T> {
        throw new Error('Method not implemented.');
    }
    query<T = any>(query: string, parameters?: any[], queryRunner?: QueryRunner): Promise<T> {
        throw new Error('Method not implemented.');
    }
    sql<T = any>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
        throw new Error('Method not implemented.');
    }
    createQueryBuilder(entityClass?: unknown, alias?: unknown, queryRunner?: unknown): import("typeorm").SelectQueryBuilder<Entity> | import("typeorm").SelectQueryBuilder<any> {
        throw new Error('Method not implemented.');
    }
    createQueryRunner(mode?: ReplicationMode): QueryRunner {
        throw new Error('Method not implemented.');
    }
    getManyToManyMetadata(entityTarget: EntityTarget<any>, relationPropertyPath: string): EntityMetadata | undefined {
        throw new Error('Method not implemented.');
    }
    createEntityManager(queryRunner?: QueryRunner): EntityManager {
        throw new Error('Method not implemented.');
    }
    protected findMetadata(target: EntityTarget<any>): EntityMetadata | undefined {
        throw new Error('Method not implemented.');
    }
    protected buildMetadatas(): Promise<void> {
        throw new Error('Method not implemented.');
    }
    defaultReplicationModeForReads(): ReplicationMode {
        throw new Error('Method not implemented.');
    }
    prototype: TypeOrmDataSource;

}