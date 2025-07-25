export function mapEnumToArrayOfValues(enumeration: any): string[] {
    return Object.entries(enumeration).map(([key, value]) => value?.toString()) as string[];
}