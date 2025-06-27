import "reflect-metadata";
import { loadDotEnvForKey } from "../functions/load-dot-env-for-key.function";

export function EnvironmentClass(envFileKey?: string) {

    return function (ctr: any) {
        return class extends ctr {
            constructor() {
                super();
                loadDotEnvForKey(envFileKey);
                const instance = new ctr();
                Object.entries(instance).forEach(([key, _value]) => {
                    const value = process.env[key] || _value;

                    if (!value) {
                        console.warn(`${ctr.name} MISSING ENV VAR ${key}`);
                    }

                    instance[key] = process.env[key];
                });
                return { ...instance };
            }
        } as typeof ctr;
    };
}