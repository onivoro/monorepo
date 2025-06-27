import { IRetryConfig } from "./retry-config.interface";

export type THeaderSetterMap<TData> = Record<string, (req: IRetryConfig<TData>) => string>