import { TErrorHandler } from "./error-handler.type";

export type TErrorHandlerMap<TData> = Record<number, TErrorHandler<TData>>;