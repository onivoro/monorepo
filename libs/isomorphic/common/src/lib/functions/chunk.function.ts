export function chunk<T>(array: T[], numDivisions: number): T[][] {
    if (numDivisions <= 0) {
        throw new Error('Number of divisions must be greater than or equal to 0');
    }

    if (array.length === 0) {
        return [];
    }

    const result: T[][] = [];
    const chunkSize = Math.ceil(array.length / numDivisions);

    for (let i = 0; i < array.length; i += chunkSize) {
        result.push(array.slice(i, i + chunkSize));
    }

    while (result.length > numDivisions) {
        const lastChunk = result.pop();
        if (lastChunk) {
            result[result.length - 1].push(...lastChunk);
        }
    }

    return result;
}