import { AxiosRequestConfig } from "axios";

export interface IRetryConfig<TData> extends AxiosRequestConfig<TData> {
    retry?: number;
    retryDelay?: number;
}