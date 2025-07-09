import { getRandomValues } from "crypto";

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateFirestoreId(length = 20): string {
    let result = '';

    const randomValues = new Uint8Array(length);

    getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
        result += chars.charAt(randomValues[i] % chars.length);
    }

    return result;
}