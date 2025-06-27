export function tryParseDate(input: string | Date | undefined | null): Date | undefined {
    if (!input) {
        return;
    }

    if(input instanceof Date) {
        return input;
    }

    const date = new Date(input);

    if ((date as any) == 'Invalid Date') {
        return;
    }

    return date;
}
