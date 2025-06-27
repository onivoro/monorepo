import { existsSync } from "fs";
import { loadEnvFile as nodeLoadEnvFile } from "process";

export function loadDotEnvForKey(envFileKey?: string) {
    if (envFileKey) {
        const envFilePath = process.env[envFileKey];
        loadEnvFile(envFilePath);
    }
}

export function loadEnvFile(envFile?: string | undefined, loadEnvLocalFile = true) {
    if (envFile) {
        if (existsSync(envFile)) {
            nodeLoadEnvFile(envFile);
        } else {
            console.warn(`specified environment path "${envFile}" does not exist`);
        }

        const localEnvOverrideFile = '.env.local';

        if (loadEnvLocalFile && existsSync(localEnvOverrideFile)) {
            nodeLoadEnvFile(localEnvOverrideFile);
        }
    }
}