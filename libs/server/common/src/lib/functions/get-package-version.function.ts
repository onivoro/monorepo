import { parsePackageJson } from "./parse-package-json.function";

export async function getPackageVersion(targetPackagePath?: string) {
    return (await parsePackageJson(targetPackagePath)).version;
}
