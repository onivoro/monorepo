import { createAxiosInstance } from './create-axios-instance.function';
import { TApiConfig } from '../types/api-config.type';

describe('createAxiosInstance - Integration Tests', () => {
  const VALID_ENDPOINT = 'https://jsonplaceholder.typicode.com/todos/1';
  const INVALID_ENDPOINT = 'https://jsonplaceholder.typicode.com/not-valid/1';

  describe('Success Scenarios', () => {
    it('should successfully make a GET request to a valid endpoint', async () => {
      const config: TApiConfig = {
        apiUrl: VALID_ENDPOINT,
      };

      const instance = createAxiosInstance(config);
      const response = await instance.get(VALID_ENDPOINT);

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('id');
      expect(response.data).toHaveProperty('title');
      expect(response.data.id).toBe(1);
    });

    it('should call onRequest handler when making a request', async () => {
      const onRequestMock = jest.fn();
      const config: TApiConfig = {
        apiUrl: VALID_ENDPOINT,
        onRequest: onRequestMock,
      };

      const instance = createAxiosInstance(config);
      await instance.get(VALID_ENDPOINT);

      expect(onRequestMock).toHaveBeenCalled();
      expect(onRequestMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'get',
          url: VALID_ENDPOINT,
        })
      );
    });

    it('should call onResponse handler when receiving a successful response', async () => {
      const onResponseMock = jest.fn();
      const config: TApiConfig = {
        apiUrl: VALID_ENDPOINT,
        onResponse: onResponseMock,
      };

      const instance = createAxiosInstance(config);
      await instance.get(VALID_ENDPOINT);

      expect(onResponseMock).toHaveBeenCalled();
      expect(onResponseMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 200,
          data: expect.objectContaining({
            id: 1,
          }),
        })
      );
    });

    it('should add custom headers via addHeaders function', async () => {
      const addHeadersMock = jest.fn((req) => ({
        'X-Custom-Header': 'test-value',
        'Authorization': 'Bearer token123',
      }));

      const config: TApiConfig = {
        apiUrl: VALID_ENDPOINT,
        addHeaders: addHeadersMock,
      };

      const instance = createAxiosInstance(config);
      const response = await instance.get(VALID_ENDPOINT);

      expect(addHeadersMock).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should call both onRequest and onResponse handlers in sequence', async () => {
      const callOrder: string[] = [];

      const config: TApiConfig = {
        apiUrl: VALID_ENDPOINT,
        onRequest: () => callOrder.push('request'),
        onResponse: () => callOrder.push('response'),
      };

      const instance = createAxiosInstance(config);
      await instance.get(VALID_ENDPOINT);

      expect(callOrder).toEqual(['request', 'response']);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle 404 errors by throwing', async () => {
      const config: TApiConfig = {
        apiUrl: INVALID_ENDPOINT,
      };

      const instance = createAxiosInstance(config);

      await expect(instance.get(INVALID_ENDPOINT)).rejects.toThrow();
    });

    it('should call onError handler when a 404 error occurs', async () => {
      const onErrorMock = jest.fn();
      const config: TApiConfig = {
        apiUrl: INVALID_ENDPOINT,
        onError: onErrorMock,
      };

      const instance = createAxiosInstance(config);

      try {
        await instance.get(INVALID_ENDPOINT);
      } catch {
        // Expected to throw
      }

      expect(onErrorMock).toHaveBeenCalled();
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
        })
      );
    });

    it('should not call onResponse handler when an error occurs', async () => {
      const onResponseMock = jest.fn();
      const config: TApiConfig = {
        apiUrl: INVALID_ENDPOINT,
        onResponse: onResponseMock,
      };

      const instance = createAxiosInstance(config);

      try {
        await instance.get(INVALID_ENDPOINT);
      } catch {
        // Expected to throw
      }

      expect(onResponseMock).not.toHaveBeenCalled();
    });

    it('should call both onError and status-specific handler (on404) when 404 occurs', async () => {
      const onErrorMock = jest.fn();
      const on404Mock = jest.fn();
      const config: TApiConfig = {
        apiUrl: INVALID_ENDPOINT,
        onError: onErrorMock,
        on404: on404Mock,
      };

      const instance = createAxiosInstance(config);

      try {
        await instance.get(INVALID_ENDPOINT);
      } catch {
        // Expected to throw
      }

      expect(onErrorMock).toHaveBeenCalled();
      expect(on404Mock).toHaveBeenCalled();
      expect(on404Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 404,
        })
      );
    });

    it('should call onError but not on400 when 404 occurs', async () => {
      const onErrorMock = jest.fn();
      const on400Mock = jest.fn();
      const config: TApiConfig = {
        apiUrl: INVALID_ENDPOINT,
        onError: onErrorMock,
        on400: on400Mock,
      };

      const instance = createAxiosInstance(config);

      try {
        await instance.get(INVALID_ENDPOINT);
      } catch {
        // Expected to throw
      }

      expect(onErrorMock).toHaveBeenCalled();
      expect(on400Mock).not.toHaveBeenCalled();
    });

    it('should not swallow errors when swallowErrors is undefined', async () => {
      const config: TApiConfig = {
        apiUrl: INVALID_ENDPOINT,
      };

      const instance = createAxiosInstance(config);

      await expect(instance.get(INVALID_ENDPOINT)).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should swallow errors when swallowErrors is true', async () => {
      const onErrorMock = jest.fn();
      const config: TApiConfig = {
        apiUrl: INVALID_ENDPOINT,
        onError: onErrorMock,
        swallowErrors: true,
      };

      const instance = createAxiosInstance(config);

      // Should not throw - this should complete without error
      let error: any;
      try {
        await instance.get(INVALID_ENDPOINT);
      } catch (e) {
        error = e;
      }

      expect(error).toBeUndefined();
      expect(onErrorMock).toHaveBeenCalled();
    });

    it('should swallow errors and call status handler when swallowErrors is true', async () => {
      const onErrorMock = jest.fn();
      const on404Mock = jest.fn();
      const config: TApiConfig = {
        apiUrl: INVALID_ENDPOINT,
        onError: onErrorMock,
        on404: on404Mock,
        swallowErrors: true,
      };

      const instance = createAxiosInstance(config);

      // Should not throw
      await instance.get(INVALID_ENDPOINT);

      expect(onErrorMock).toHaveBeenCalled();
      expect(on404Mock).toHaveBeenCalled();
    });

    it('should pass default error object to handlers when response is undefined', async () => {
      const onErrorMock = jest.fn();
      const config: TApiConfig = {
        apiUrl: INVALID_ENDPOINT,
        onError: onErrorMock,
        swallowErrors: true,
      };

      const instance = createAxiosInstance(config);
      await instance.get(INVALID_ENDPOINT);

      expect(onErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.any(Object),
        })
      );
    });

    it('should handle multiple requests in parallel', async () => {
      const config: TApiConfig = {
        apiUrl: VALID_ENDPOINT,
      };

      const instance = createAxiosInstance(config);

      const [response1, response2, response3] = await Promise.all([
        instance.get(VALID_ENDPOINT),
        instance.get(VALID_ENDPOINT),
        instance.get(VALID_ENDPOINT),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);
    });
  });

  describe('Handler Isolation', () => {
    it('should isolate handlers between different instances', async () => {
      const onResponseMock1 = jest.fn();
      const onResponseMock2 = jest.fn();

      const instance1 = createAxiosInstance({
        apiUrl: VALID_ENDPOINT,
        onResponse: onResponseMock1,
      });

      const instance2 = createAxiosInstance({
        apiUrl: VALID_ENDPOINT,
        onResponse: onResponseMock2,
      });

      await instance1.get(VALID_ENDPOINT);
      await instance2.get(VALID_ENDPOINT);

      expect(onResponseMock1).toHaveBeenCalledTimes(1);
      expect(onResponseMock2).toHaveBeenCalledTimes(1);
    });

    it('should not share headers between different instances', async () => {
      const instance1 = createAxiosInstance({
        apiUrl: VALID_ENDPOINT,
        addHeaders: () => ({ 'X-Instance': '1' }),
      });

      const instance2 = createAxiosInstance({
        apiUrl: VALID_ENDPOINT,
        addHeaders: () => ({ 'X-Instance': '2' }),
      });

      const response1 = await instance1.get(VALID_ENDPOINT);
      const response2 = await instance2.get(VALID_ENDPOINT);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });
});