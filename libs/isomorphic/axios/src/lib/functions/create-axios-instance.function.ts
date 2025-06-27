import axios from 'axios';
import { TApiConfig } from '../types/api-config.type';

export function createAxiosInstance(config: TApiConfig) {

  const { onError, on401, on403, on400, on500, addHeaders, onRequest, onResponse } = config;

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

      if (err?.response?.status === 400) {
        if (typeof on400 === 'function') {
          on400(err?.response || defaultError);
        }
      } else if (err?.response?.status === 401) {
        if (typeof on401 === 'function') {
          on401(err?.response || defaultError);
        }
      } else if (err?.response?.status === 403) {
        if (typeof on403 === 'function') {
          on403(err?.response || defaultError);
        }
      } else if (err?.response?.status === 500) {
        if (typeof on500 === 'function') {
          on500(err?.response || defaultError);
        }
      } else {
        throw err;
      }
    }
  );

  return instance;
}
