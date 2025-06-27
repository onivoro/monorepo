export function sortById<TEntity extends { id: string }>(a: TEntity, b: TEntity) {
    return a?.id?.localeCompare(b?.id || '') || 0;
}