import { ILookup } from "../types/lookup.interface";

export function mapEnumToOptions<TEntity extends object>(enumeration: TEntity, includeBlank = true): ILookup<string, string> {
    const enumArray = Object.entries(enumeration).map(([key, value]) => ({ value, display: key.replace(/_/g, ' ') }))

    return (includeBlank
        ? [{ display: '', value: '' }, ...enumArray]
        : enumArray) as any;
}