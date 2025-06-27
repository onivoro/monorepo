export function encode (value: object = {}) {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64');
    return `.${payload}.`;
}