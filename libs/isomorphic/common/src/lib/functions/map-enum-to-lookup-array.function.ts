import { ILookup } from "../types/lookup.interface";

export function mapEnumToLookupArray<TEnum extends object>(enumeration: TEnum): ILookup<string, string>[] {
    return Object.entries(enumeration)
        .map(([key, value]) => ({ value, display: key.replace(/_/g, ' ') }) satisfies ILookup<string, string>);
}