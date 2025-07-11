# @onivoro/isomorphic-axios

Lightweight Axios wrapper for creating configured HTTP clients with built-in error handling and retry logic. This package provides utilities for creating Axios instances with custom interceptors and integrating with OpenAPI-generated client classes.

## Installation

```bash
npm install @onivoro/isomorphic-axios
```

## Features

- **Simple Axios Instance Creation**: Quick setup with error handlers and header injection
- **Advanced Factory Pattern**: Comprehensive configuration with retry logic and status-specific handlers
- **OpenAPI Integration**: Seamless integration with auto-generated API client classes
- **Built-in Retry Logic**: Configurable retry mechanism with delays
- **TypeScript Support**: Full type definitions for all configurations

## API Reference

### Core Functions

#### `createAxiosInstance(config: TApiConfig): AxiosInstance`

Creates a basic Axios instance with request/response interceptors for headers and error handling.

```typescript
import { createAxiosInstance } from '@onivoro/isomorphic-axios';

const client = createAxiosInstance({
  apiUrl: 'https://api.example.com',
  addHeaders: (req) => ({
    'Authorization': `Bearer ${getToken()}`,
    'X-API-Key': 'my-api-key'
  }),
  on400: (response) => {
    console.error('Bad request:', response.data);
  },
  on401: (response) => {
    // Handle unauthorized
    window.location.href = '/login';
  },
  on403: (response) => {
    console.error('Forbidden:', response.data);
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
  }
});

// Use the client
const data = await client.get('/users');
```

**Note**: Error handlers (on400, on401, etc.) do not throw errors by default. If an error handler is not provided for a status code, the error will be thrown.

#### `createApi<TApi>(DefaultApi: ConstructorFunction<TApi>, config: TApiConfig): TApi`

Creates an instance of an OpenAPI-generated client class with a configured Axios instance.

```typescript
import { createApi } from '@onivoro/isomorphic-axios';
import { UserApi } from './generated/api';

const userApi = createApi(UserApi, {
  apiUrl: 'https://api.example.com',
  addHeaders: (req) => ({
    'Authorization': `Bearer ${getToken()}`
  }),
  on401: (response) => {
    // Handle unauthorized
    redirectToLogin();
  }
});

// Use the generated API methods
const users = await userApi.getUsers();
const user = await userApi.createUser({ name: 'John Doe' });
```

**Note**: This function is designed to work with OpenAPI client generators that accept `(configuration, basePath, axiosInstance)` as constructor parameters.

#### `axiosInstanceFactory<TData>(params): AxiosInstance`

Advanced factory for creating Axios instances with retry logic and granular control over headers and error handling.

```typescript
import { axiosInstanceFactory } from '@onivoro/isomorphic-axios';

const client = axiosInstanceFactory({
  headerSetters: {
    'Authorization': (req) => `Bearer ${getToken()}`,
    'X-Request-ID': (req) => generateRequestId()
  },
  errorHandlers: {
    401: async (err, response) => {
      // Handle unauthorized
      await refreshToken();
      throw err; // Retry will happen if configured
    },
    0: async (err, response) => {
      // Default handler for unhandled status codes
      console.error('Request failed:', err);
      throw err;
    }
  },
  beforeRetryHandlers: {
    429: async (err, response) => {
      // Wait before retrying rate-limited requests
      const retryAfter = response?.headers['retry-after'];
      await sleep(retryAfter * 1000);
    }
  },
  axiosConfigOverride: {
    timeout: 10000,
    retry: 3,
    retryDelay: 1000
  }
});
```

**Important**: 
- Error handlers must either return a value or throw an error
- The `0` key in errorHandlers/beforeRetryHandlers acts as a default handler
- Retry logic is built into the interceptor

#### `retryAxiosCall<TData>(err: any, instance: AxiosInstance): Promise<any>`

Utility function for manually implementing retry logic. Used internally by `axiosInstanceFactory`.

```typescript
import { retryAxiosCall } from '@onivoro/isomorphic-axios';

// Custom retry implementation
instance.interceptors.response.use(
  response => response,
  async (error) => {
    if (error.config && error.config.retry > 0) {
      return await retryAxiosCall(error, instance);
    }
    throw error;
  }
);
```

### Constants

#### `defaultAxiosConfig: IRetryConfig<any>`

Default configuration for retry behavior:

```typescript
{
  retry: 3,
  retryDelay: 1000
}
```

### Types

#### `TApiConfig`

Configuration type for `createAxiosInstance` and `createApi`:

```typescript
type TApiConfig = {
  apiUrl: string;
  uiUrl?: string;
  addHeaders?: (req: any) => Record<string, string>;
  on400?: (response: any) => any;
  on401?: (response: any) => any;
  on403?: (response: any) => any;
  on500?: (response: any) => any;
  onRequest?: (request: any) => any;
  onResponse?: (response: any) => any;
  onError?: (response: any) => any;
};
```

#### `IRetryConfig<TData>`

Extends Axios request config with retry settings:

```typescript
interface IRetryConfig<TData> extends AxiosRequestConfig<TData> {
  retry?: number;
  retryDelay?: number;
}
```

#### `TErrorHandler<TData>`

Type for error handling functions:

```typescript
type TErrorHandler<TData> = (
  err?: any,
  res?: AxiosResponse<TData, IRetryConfig<TData>>
) => Promise<TData>;
```

#### `THeaderSetterMap<TData>`

Map of header names to functions that compute header values:

```typescript
type THeaderSetterMap<TData> = Record<string, (req: IRetryConfig<TData>) => string>;
```

#### `TErrorHandlerMap<TData>`

Map of HTTP status codes to error handlers:

```typescript
type TErrorHandlerMap<TData> = Record<number, TErrorHandler<TData>>;
```

## Common Usage Patterns

### Simple API Client

```typescript
import { createAxiosInstance } from '@onivoro/isomorphic-axios';

const api = createAxiosInstance({
  apiUrl: process.env.API_URL,
  addHeaders: () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }),
  on401: () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
});

// Make requests
const users = await api.get('/users');
const user = await api.post('/users', { name: 'Jane Doe' });
```

### API Client with Retry Logic

```typescript
import { axiosInstanceFactory, defaultAxiosConfig } from '@onivoro/isomorphic-axios';

const apiWithRetry = axiosInstanceFactory({
  headerSetters: {
    'Authorization': () => `Bearer ${getToken()}`
  },
  errorHandlers: {
    0: async (err) => {
      console.error('Request failed:', err.message);
      throw err;
    }
  },
  beforeRetryHandlers: {
    0: async (err) => {
      console.log(`Retrying request... ${err.config.retry} attempts left`);
    }
  },
  axiosConfigOverride: {
    ...defaultAxiosConfig,
    baseURL: 'https://api.example.com',
    retry: 5,
    retryDelay: 2000
  }
});
```

### OpenAPI Client Integration

```typescript
import { createApi } from '@onivoro/isomorphic-axios';
import { DefaultApi } from './generated';

const api = createApi(DefaultApi, {
  apiUrl: process.env.API_BASE_URL,
  addHeaders: (req) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  },
  onError: (response) => {
    logError('API Error', response);
  }
});

// Use typed methods from generated client
const result = await api.getUserById(123);
```

### Environment-Specific Configuration

```typescript
import { createAxiosInstance } from '@onivoro/isomorphic-axios';

const isDev = process.env.NODE_ENV === 'development';

const client = createAxiosInstance({
  apiUrl: isDev ? 'http://localhost:3000' : 'https://api.prod.com',
  addHeaders: (req) => ({
    'Authorization': `Bearer ${getToken()}`,
    ...(isDev && { 'X-Debug': 'true' })
  }),
  onRequest: isDev ? (req) => {
    console.log(`[API] ${req.method?.toUpperCase()} ${req.url}`);
  } : undefined,
  onResponse: isDev ? (res) => {
    console.log(`[API] Response ${res.status}`);
  } : undefined,
  onError: (response) => {
    if (isDev) {
      console.error('[API] Error:', response);
    }
    // Log to error tracking service in production
    if (!isDev) {
      errorTracker.log(response);
    }
  }
});
```

## Important Notes

1. **Error Handling**: In `createAxiosInstance`, error handlers (on400, on401, etc.) suppress errors by default. If you need to propagate errors, you must throw them explicitly in your handler.

2. **Retry Configuration**: When using `axiosInstanceFactory`, retry configuration should be passed in `axiosConfigOverride`. The retry counter decrements with each attempt.

3. **Header Functions**: Header setter functions receive the request configuration object, allowing dynamic header generation based on request context.

4. **OpenAPI Integration**: The `createApi` function expects generated API classes that follow the pattern of accepting configuration, basePath, and axios instance as constructor parameters.

## License

This library is licensed under the MIT License. See the LICENSE file in this package for details.