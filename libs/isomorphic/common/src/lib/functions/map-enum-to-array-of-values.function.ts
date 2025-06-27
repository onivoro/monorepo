export function mapEnumToArrayOfValues(enumeration: any): any {
    return Object.entries(enumeration).map(([key, value]) => value) as string[];
}