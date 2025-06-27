export function parseCsvString(value?: string | undefined) {
    return value ? value.split(',').map(_ => _.trim()).filter(Boolean) : [];
}