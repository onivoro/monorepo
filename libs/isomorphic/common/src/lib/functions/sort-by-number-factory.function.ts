export function sortByNumberFactory<TEntity>(propertyName: keyof TEntity) {
    return function (a: TEntity, b: TEntity) {
        const resolvedA = a[propertyName] || 0;
        const resolvedB = b[propertyName] || 0;

        if (resolvedA == resolvedB) {
            return 0;
        }

        return resolvedA < resolvedB ? -1 : 1;
    }
}