import { IRetryConfig } from "../types/retry-config.interface";

export const defaultAxiosConfig: IRetryConfig<any> = {
  retry: 3,
  retryDelay: 1000,
};
