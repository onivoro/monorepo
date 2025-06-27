import { AxiosInstance } from "axios";
import { IRetryConfig } from "../types/retry-config.interface";
import { defaultAxiosConfig } from "../constants/default-axios-config.constant";

export async function retryAxiosCall<TData>(err: any, instance: AxiosInstance) {
        const { config } = err as { config: IRetryConfig<TData> };

        if (!config) {
          return Promise.reject(err);
        }

        if(!config.retry) {
            config.retry = defaultAxiosConfig.retry;
        }

        (config.retry as number) -= 1;

        await new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, config.retryDelay || 1000)
        })

        return await instance(config);
}