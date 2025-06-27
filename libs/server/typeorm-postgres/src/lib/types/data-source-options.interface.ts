export interface IDataSourceOptions {
    database: string,
    host: string,
    port: string,
    username: string,
    password: string,
    synchronize?: boolean,
    logging?: boolean,
    schema?: string,
    ca?: string,
}