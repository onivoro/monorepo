# @onivoro/isomorphic-axios

Lightweight Axios wrapper for creating configured HTTP clients with built-in error handling and retry logic. This package provides utilities for creating Axios instances with custom interceptors and integrating with OpenAPI-generated client classes.

## Installation

```bash
npm install @onivoro/isomorphic-axios axios
```

`axios` is a peer dependency.

## Features

- **Simple Axios Instance Creation**: Quick setup with header injection, lifecycle hooks and status-specific error callbacks
- **Retrying Factory**: Axios instance with per-header setters, status-keyed error handlers and automatic retries
- **OpenAPI Integration**: Construct OpenAPI-generated (`typescript-axios`) client classes with a configured Axios instance
- **TypeScript Support**: Full type definitions for all configurations

## API Reference

### Core Functions

#### `createAxiosInstance(config: TApiConfig): AxiosInstance`

Creates an Axios instance (via a bare `axios.create()`) with request/response interceptors for headers, hooks and error callbacks.

```typescript
import { createAxiosInstance } from '@onivoro/isomorphic-axios';

const client = createAxiosInstance({
  apiUrl: 'https://api.example.com', // required by the type, but not applied to the instance (see below)
  addHeaders: (req) => ({
    Authorization: `Bearer ${getToken()}`,
    'X-API-Key': 'my-api-key',
  }),
  on400: (response) => {
    console.error('Bad request:', response.data);
  },
  on401: (response) => {
    window.location.href = '/login';
  },
  on500: (response) => {
    console.error('Server error:', response.data);
  },
  onRequest: (request) => {
    console.log('Request:', request.url);
  },
  onResponse: (response) => {
    console.log('Response:', response.status);
  },
  onError: (response) => {
    console.error('Error:', response);
  },
});

const { data } = await client.get('https://api.example.com/users');
```

How the interceptors behave:

- `addHeaders(req)` is called for every request; each returned key/value is set on `req.headers`.
- `onRequest(req)` and `onResponse(res)` are called for side effects only; their return values are ignored.
- On an error, `onError` is called first with `err.response` (or `{ config: {} }` when there is no response, e.g. a network error). Then, if the response has a status, the matching `on<status>` callback (e.g. `on401`) is called with the same value.
- After the callbacks run, the original error is **re-thrown** unless `swallowErrors: true` is set. With `swallowErrors: true`, the failed request resolves to `undefined`.
- `apiUrl` is **not** used as the instance's `baseURL`; use absolute URLs or set `client.defaults.baseURL` yourself. (`createApi` passes `apiUrl` to the generated client as its base path.)

#### `createApi<TApi>(DefaultApi: new (...params: any[]) => TApi, config: TApiConfig): TApi`

Creates an instance of an OpenAPI-generated client class, wired to an Axios instance from `createAxiosInstance(config)`. The class is constructed as `new DefaultApi({ basePath: apiUrl }, apiUrl, axiosInstance)`, which matches the `(configuration, basePath, axios)` constructor of `openapi-generator`'s `typescript-axios` output.

```typescript
import { createApi } from '@onivoro/isomorphic-axios';
import { UserApi } from './generated/api';

const userApi = createApi(UserApi, {
  apiUrl: 'https://api.example.com',
  addHeaders: () => ({
    Authorization: `Bearer ${getToken()}`,
  }),
  on401: () => redirectToLogin(),
});

const users = await userApi.getUsers();
```

#### `axiosInstanceFactory<TData>(params): AxiosInstance`

Factory for Axios instances with header setters, status-keyed error handlers and built-in retries.

```typescript
params: {
  headerSetters: THeaderSetterMap<TData>;
  errorHandlers: TErrorHandlerMap<TData>;
  beforeRetryHandlers: TErrorHandlerMap<TData>;
  axiosConfigOverride?: AxiosRequestConfig;
}
```

```typescript
import { axiosInstanceFactory } from '@onivoro/isomorphic-axios';

const client = axiosInstanceFactory({
  headerSetters: {
    Authorization: (req) => `Bearer ${getToken()}`,
    'X-Request-ID': (req) => generateRequestId(),
  },
  errorHandlers: {
    0: async (err, response) => {
      // Default handler, called once retries are exhausted
      console.error('Request failed:', err.message);
      throw err;
    },
  },
  beforeRetryHandlers: {
    401: async (err, response) => {
      await refreshToken();
    },
  },
});
```

How it behaves:

- The instance is created with `defaultAxiosConfig` (`retry: 3`, `retryDelay: 1000`) merged with `axiosConfigOverride` (override wins, so options such as `baseURL`, `timeout`, `retry` or `retryDelay` set there apply to every request) as defaults, so every request is retried up to 3 times by default, with a 1000 ms delay between attempts. Retries happen for **any** failed request, regardless of status.
- Each `headerSetters` entry sets one header to the function's return value on every request.
- An error without a `response` (e.g. a network failure) is treated as status `0`, so only the `0` fallback handlers apply to it.
- Before each retry, `beforeRetryHandlers[status]` (or `beforeRetryHandlers[0]` as a fallback) is awaited.
- Once `config.retry` reaches `0`, `errorHandlers[status]` (or `errorHandlers[0]`) is called; whatever it resolves to becomes the request's result, and if it throws, the request rejects. With no matching handler, the original error is rejected.
- Retry settings can be changed per request by passing `retry` / `retryDelay` in the request config (cast to `IRetryConfig`):

```typescript
import { IRetryConfig } from '@onivoro/isomorphic-axios';

await client.get('https://api.example.com/flaky', { retry: 5, retryDelay: 2000 } as IRetryConfig<unknown>);
```

#### `retryAxiosCall<TData>(err: any, instance: AxiosInstance): Promise<any>`

Standalone helper for writing your own retry interceptor (it is not used by `axiosInstanceFactory`). It decrements `err.config.retry`, waits `err.config.retryDelay` (default 1000 ms), and re-issues the request with `instance(config)`. If `err.config` is missing it rejects with `err`. If `config.retry` is falsy it is **reset** to `defaultAxiosConfig.retry` (3) before decrementing, so guard the call yourself:

```typescript
import axios from 'axios';
import { retryAxiosCall } from '@onivoro/isomorphic-axios';

const instance = axios.create();

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.config && error.config.retry > 0) {
      return await retryAxiosCall(error, instance);
    }
    throw error;
  },
);
```

### Constants

#### `defaultAxiosConfig: IRetryConfig<any>`

```typescript
{
  retry: 3,
  retryDelay: 1000
}
```

### Types

#### `TApiConfig`

Configuration for `createAxiosInstance` and `createApi`:

```typescript
type TApiConfig = {
  apiUrl: string;
  uiUrl?: string; // not used by this package
  addHeaders?: (req: any) => Record<string, string>;
  // on400, on401, ... on511: one optional callback per status code
  on400?: (response: any) => any;
  on401?: (response: any) => any;
  // ...
  onRequest?: (request: any) => any;
  onResponse?: (response: any) => any;
  onError?: (response: any) => any;
  swallowErrors?: boolean;
};
```

Status callbacks are declared for 400–418, 421–426, 428, 429, 431, 451, 500–508, 510 and 511.

#### `IRetryConfig<TData>`

Extends Axios request config with retry settings:

```typescript
interface IRetryConfig<TData> extends AxiosRequestConfig<TData> {
  retry?: number;
  retryDelay?: number;
}
```

#### `TErrorHandler<TData>`

```typescript
type TErrorHandler<TData> = (err?: any, res?: AxiosResponse<TData, IRetryConfig<TData>>) => Promise<TData>;
```

#### `THeaderSetterMap<TData>`

Map of header names to functions that compute header values:

```typescript
type THeaderSetterMap<TData> = Record<string, (req: IRetryConfig<TData>) => string>;
```

#### `TErrorHandlerMap<TData>`

Map of HTTP status codes to error handlers; key `0` is the fallback:

```typescript
type TErrorHandlerMap<TData> = Record<number, TErrorHandler<TData>>;
```

## Common Usage Patterns

### Simple API Client

```typescript
import { createAxiosInstance } from '@onivoro/isomorphic-axios';

const apiUrl = process.env.API_URL!;

const api = createAxiosInstance({
  apiUrl,
  addHeaders: () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  }),
  on401: () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  },
});
api.defaults.baseURL = apiUrl;

const users = await api.get('/users');
const user = await api.post('/users', { name: 'Jane Doe' });
```

### OpenAPI Client Integration

```typescript
import { createApi } from '@onivoro/isomorphic-axios';
import { DefaultApi } from './generated';

const api = createApi(DefaultApi, {
  apiUrl: process.env.API_BASE_URL!,
  addHeaders: () => {
    const headers: Record<string, string> = {};
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },
  onError: (response) => {
    logError('API Error', response);
  },
});

const result = await api.getUserById(123);
```

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.
