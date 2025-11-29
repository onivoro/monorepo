import axios from 'axios';
import { TApiConfig } from '../types/api-config.type';

export function createAxiosInstance(_: TApiConfig) {

  const { onError, addHeaders, onRequest, onResponse } = _;

  const instance = axios.create();

  instance.interceptors.request.use(req => {

    if (!req.headers) {
      req.headers = {} as any;
    }

    if (typeof addHeaders === 'function') {
      Object.entries(addHeaders(req) || {}).forEach(([name, value]) => req.headers[name] = value);
    }

    if (typeof onRequest === 'function') {
      onRequest(req);
    }

    return req;
  })

  instance.interceptors.response.use(
    (response) => {
      if (typeof onResponse === 'function') {
        onResponse(response);
      }

      return response;
    },
    (err) => {
      const defaultError = {config: {}};

      if (typeof onError === 'function') {
        onError(err?.response || defaultError);
      }

      const status = Number(err?.response?.status);

      if (status) {
        const handler = _[`on${status}`];
        if (handler && (typeof handler === 'function')) {
          handler(err?.response || defaultError);
        }
      }

      if (!_.swallowErrors) {
        throw err;
      }
    }
  );

  return instance;
}
