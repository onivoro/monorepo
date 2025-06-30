# @onivoro/isomorphic-axios

HTTP client utilities and Axios configuration for both browser and server environments. This package provides a comprehensive set of tools for creating configurable Axios instances with built-in retry logic, error handling, and request/response interceptors that work seamlessly across client and server codebases.

## Installation

```bash
npm install @onivoro/isomorphic-axios
```

## Features

- **Isomorphic Design**: Works identically in browser and Node.js environments
- **Advanced Axios Factory**: Create pre-configured Axios instances with custom interceptors
- **Retry Logic**: Built-in request retry mechanism with configurable delays
- **Error Handling**: Flexible error handling with status-specific handlers
- **Header Management**: Dynamic header setting based on request context
- **API Client Factory**: Streamlined creation of API clients from OpenAPI specs
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions

## Quick Start

### Basic Axios Instance Creation

```typescript
import { createAxiosInstance } from '@onivoro/isomorphic-axios';

// Create a simple axios instance
const apiClient = createAxiosInstance({
  apiUrl: 'https://api.example.com',
  accessToken: 'your-token-here'
});

// Use the instance
const response = await apiClient.get('/users');
```

### Advanced Axios Factory with Custom Configuration

```typescript
import { axiosInstanceFactory } from '@onivoro/isomorphic-axios';

const axiosInstance = axiosInstanceFactory({
  headerSetters: {
    'Authorization': (req) => `Bearer ${getToken()}`,
    'X-API-Key': (req) => process.env.API_KEY,
    'Content-Type': (req) => 'application/json'
  },
  errorHandlers: {
    401: async (error, response) => {
      // Handle unauthorized errors
      await refreshToken();
      return retry(error);
    },
    500: async (error, response) => {
      // Handle server errors
      console.error('Server error:', response?.data);
      throw error;
    },
    0: async (error, response) => {
      // Default error handler
      console.error('Request failed:', error.message);
      throw error;
    }
  },
  beforeRetryHandlers: {
    429: async (error, response) => {
      // Handle rate limiting before retry
      const retryAfter = response?.headers['retry-after'];
      if (retryAfter) {
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      }
    }
  },
  axiosConfigOverride: {
    timeout: 10000,
    retry: 3,
    retryDelay: 2000
  }
});
```

## Usage Examples

### Creating API Clients

```typescript
import { createApi } from '@onivoro/isomorphic-axios';
import { DefaultApi } from './generated-client';

// Create an API client from generated OpenAPI client
const apiClient = createApi(DefaultApi, {
  apiUrl: 'https://api.example.com',
  accessToken: 'your-token'
});

// Use the generated API methods
const users = await apiClient.getUsers();
const user = await apiClient.createUser({ name: 'John Doe' });
```

### Manual Retry Logic

```typescript
import { retryAxiosCall } from '@onivoro/isomorphic-axios';
import axios from 'axios';

const instance = axios.create();

instance.interceptors.response.use(
  response => response,
  async (error) => {
    if (shouldRetry(error)) {
      return retryAxiosCall(error, instance);
    }
    throw error;
  }
);
```

### Environment-Specific Configuration

```typescript
import { createAxiosInstance } from '@onivoro/isomorphic-axios';

// Browser environment
const browserClient = createAxiosInstance({
  apiUrl: window.location.origin + '/api',
  accessToken: localStorage.getItem('token')
});

// Server environment
const serverClient = createAxiosInstance({
  apiUrl: process.env.INTERNAL_API_URL,
  accessToken: process.env.SERVICE_TOKEN
});
```

### Request/Response Interceptors

```typescript
import { axiosInstanceFactory } from '@onivoro/isomorphic-axios';

const client = axiosInstanceFactory({
  headerSetters: {
    'X-Request-ID': () => generateRequestId(),
    'X-User-Agent': () => getUserAgent(),
    'X-Timestamp': () => new Date().toISOString()
  },
  errorHandlers: {
    // Retry on network errors
    0: async (error) => {
      if (error.code === 'NETWORK_ERROR') {
        throw new Error('Network connection failed');
      }
      throw error;
    },
    // Handle authentication errors
    401: async (error) => {
      await signOut();
      window.location.href = '/login';
      throw error;
    },
    // Handle validation errors
    422: async (error) => {
      const validationErrors = error.response?.data?.errors;
      throw new ValidationError(validationErrors);
    }
  }
});
```

## API Reference

### Functions

#### `axiosInstanceFactory<TData>(params)`

Creates a fully configured Axios instance with interceptors, retry logic, and error handling.

**Parameters:**
- `headerSetters`: Object mapping header names to functions that return header values
- `errorHandlers`: Object mapping HTTP status codes to error handling functions
- `beforeRetryHandlers`: Object mapping status codes to functions called before retries
- `axiosConfigOverride`: Optional Axios configuration overrides

**Returns:** Configured Axios instance

#### `createApi<TApi>(DefaultApi, config)`

Creates an API client instance from a generated OpenAPI client class.

**Parameters:**
- `DefaultApi`: Constructor function for the generated API client
- `config`: API configuration object with `apiUrl` and optional `accessToken`

**Returns:** Configured API client instance

#### `createAxiosInstance(config)`

Creates a simple Axios instance with basic authentication and URL configuration.

**Parameters:**
- `config`: Configuration object with `apiUrl` and optional `accessToken`

**Returns:** Configured Axios instance

#### `retryAxiosCall<TData>(error, instance)`

Manually retry a failed Axios request with exponential backoff.

**Parameters:**
- `error`: The error object from the failed request
- `instance`: The Axios instance to use for the retry

**Returns:** Promise resolving to the retry response

### Types

#### `TApiConfig`

Configuration interface for API clients:
```typescript
interface TApiConfig {
  apiUrl: string;
  accessToken?: string;
}
```

#### `THeaderSetterMap<TData>`

Map of header names to functions that set header values:
```typescript
type THeaderSetterMap<TData> = {
  [headerName: string]: (request: AxiosRequestConfig) => string;
};
```

#### `TErrorHandlerMap<TData>`

Map of HTTP status codes to error handling functions:
```typescript
type TErrorHandlerMap<TData> = {
  [statusCode: number]: TErrorHandler<TData>;
};
```

### Constants

#### `defaultAxiosConfig`

Default Axios configuration with sensible defaults:
```typescript
{
  timeout: 30000,
  retry: 2,
  retryDelay: 1000
}
```

## Advanced Configuration

### Custom Error Recovery

```typescript
import { axiosInstanceFactory } from '@onivoro/isomorphic-axios';

const resilientClient = axiosInstanceFactory({
  errorHandlers: {
    // Implement circuit breaker pattern
    0: async (error) => {
      if (circuitBreaker.isOpen()) {
        throw new Error('Circuit breaker is open');
      }
      circuitBreaker.recordFailure();
      throw error;
    }
  },
  beforeRetryHandlers: {
    // Implement exponential backoff with jitter
    0: async (error) => {
      const attempt = error.config.__retryCount || 0;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      const jitter = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
});
```

### Request/Response Logging

```typescript
const debugClient = axiosInstanceFactory({
  headerSetters: {
    'X-Debug-Mode': () => process.env.NODE_ENV === 'development' ? 'true' : 'false'
  },
  errorHandlers: {
    0: async (error) => {
      console.error('Request failed:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }
});
```

## License

MIT