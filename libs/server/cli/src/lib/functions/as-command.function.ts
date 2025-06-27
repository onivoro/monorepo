export function asCommand<TParams>(command: string, params: TParams, file = 'main.js'): string[] {
    const output = [file, command];

    Object.entries(params || {})
        .forEach(
            ([name, value]) => output.push(`--${name}`, `${value}`)
        );

    return output;
}