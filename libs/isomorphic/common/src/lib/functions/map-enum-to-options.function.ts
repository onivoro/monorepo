export function mapEnumToOptions<TEntity extends object>(enumeration: TEntity, includeBlank = true) {
    const enumArray = Object.entries(enumeration).map(([key, value]) => ({ value, display: key.replace(/_/g, ' ') }))

    return includeBlank
        ? [{ display: '', value: '' }, ...enumArray]
        : enumArray;
}