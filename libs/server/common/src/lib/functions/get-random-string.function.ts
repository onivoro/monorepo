import { randomUUID } from "node:crypto";

export function getRandomString(prefix?: string, postFix?: string) {
    const uuid = randomUUID();
    return `${prefix || ''}${uuid.replace(/-/g, '')}${postFix || ''}`;
}