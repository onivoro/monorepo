import { createAxiosInstance } from "./create-axios-instance.function";
import { TApiConfig } from "../types/api-config.type";

interface ConstructorFunction<TApi> {
    new(...params: any[]): TApi;
}
export function createApi<TApi>(DefaultApi: ConstructorFunction<TApi>, config: TApiConfig) {

    const {
        apiUrl,
    } = config;

    return new DefaultApi(
        { basePath: apiUrl } as any,
        apiUrl,
        createAxiosInstance(config)
    );
}