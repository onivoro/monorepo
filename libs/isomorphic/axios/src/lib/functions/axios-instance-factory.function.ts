
import axios, { AxiosRequestConfig } from 'axios';
import { defaultAxiosConfig } from '../constants/default-axios-config.constant';
import { THeaderSetterMap } from '../types/header-setting-map.type';
import { TErrorHandlerMap } from '../types/error-handler-map.type';
import { TErrorHandler } from '../types/error-handler.type';

export function axiosInstanceFactory<TData>(params:
  {
    headerSetters: THeaderSetterMap<TData>,
    errorHandlers: TErrorHandlerMap<TData>,
    beforeRetryHandlers: TErrorHandlerMap<TData>,
    axiosConfigOverride?: AxiosRequestConfig,
  }
) {

  const {
    headerSetters = {},
    beforeRetryHandlers = {},
    errorHandlers = {},
    axiosConfigOverride = defaultAxiosConfig,
  } = params;

  const globalConfig = { ...defaultAxiosConfig, axiosConfigOverride };

  const instance = axios.create(globalConfig);

  instance.interceptors.request.use(req => {

    if (!req.headers) {
      req.headers = {} as any;
    }

    Object.entries(headerSetters || {}).forEach(([header, resolver]) => {
      (req.headers as any)[header] = resolver(req);
    });

    return req;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const status = err?.response.status || 0;

      const { config } = err;

      if (!config || !config.retry) {

        const errorHandler: TErrorHandler<TData> = errorHandlers[status] || errorHandlers[0];

        if (errorHandler as any) {
          return await errorHandler(err, err?.response);
        }

        // todo: change this to throw instead of mixing Promise.reject and async/await
        return Promise.reject(err);
      }

      config.retry -= 1;

      const beforeRetryHandler: TErrorHandler<TData> = beforeRetryHandlers[status] || beforeRetryHandlers[0];

      if (beforeRetryHandler as any) {
        await beforeRetryHandler(err, err?.response);
      }

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, config.retryDelay || 1000)
      })

      return await instance(config);
    }
  );

  return instance;
}
