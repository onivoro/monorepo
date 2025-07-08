export function sortByStringFactory<TEntity>(propertyName: keyof TEntity) {
    return function (a: TEntity, b: TEntity) {
        return a[propertyName]?.toString()?.localeCompare?.(b[propertyName]?.toString() || '') || 0;
    }
}