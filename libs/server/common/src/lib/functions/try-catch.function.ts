import { InternalServerErrorException } from "@nestjs/common";

export async function tryCatch<TResult>(fn: () => Promise<TResult>) {
    try {
        return await fn();
    } catch (_: any) {
        throw new InternalServerErrorException(_.message || 'Unknown error encountered processing the request');
    }
}