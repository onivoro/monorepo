import { versionProviderToken } from "../constants/version-provider-token.constant";
import { parsePackageJson } from "../functions/parse-package-json.function";

export const versionProvider = {
    provide: versionProviderToken,
    useFactory: async () => {
        try {
            return (await parsePackageJson()).version;
        } catch (error: any) {
            return '0.0.0';
        }
    },
};