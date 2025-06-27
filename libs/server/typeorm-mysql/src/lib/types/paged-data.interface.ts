export interface IPagedData<TEntity> {
    data: TEntity[];
    total: number;
    pagingKey: number;
    pageSize: number;
}
