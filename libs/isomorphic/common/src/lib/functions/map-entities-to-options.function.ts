export function mapEntitiesToOptions<TEntity extends { name?: string, id: string }>(
    entities: Record<string, TEntity>,
    ids: string[],
    includeBlank = true,
) {
    const entityArray = ids?.length ? (ids?.map((value => ({ value, display: entities[value].name || entities[value].id })))) : [];

    return includeBlank
        ? [{ display: '', value: '' }, ...entityArray]
        : entityArray;
}