export type TEntityState<TEntity> = {
    entities: Record<string, TEntity>,
    ids: string[],
    focused?: TEntity,
    focusedId?: string,
};