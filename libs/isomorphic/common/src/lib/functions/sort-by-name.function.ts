export function sortByName<TEntity extends { name: string }>(a: TEntity, b: TEntity) {
    return a?.name?.localeCompare(b?.name || '') || 0;
}