import { readFile } from "fs/promises";

export async function parsePackageJson (targetPackagePath?: string) {
    return JSON.parse(await readFile(targetPackagePath || './package.json', 'utf-8'));
}
