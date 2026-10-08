import { AxiosError, AxiosRequestConfig } from 'axios';
import { axiosInstanceFactory } from './axios-instance-factory.function';

describe('axiosInstanceFactory', () => {
  it('applies axiosConfigOverride on top of the default config', () => {
    const instance = axiosInstanceFactory({
      headerSetters: {},
      errorHandlers: {},
      beforeRetryHandlers: {},
      axiosConfigOverride: { baseURL: 'https://example.test', timeout: 1234 },
    });

    expect(instance.defaults.baseURL).toBe('https://example.test');
    expect(instance.defaults.timeout).toBe(1234);
    expect((instance.defaults as any).retry).toBe(3);
    expect((instance.defaults as any).axiosConfigOverride).toBeUndefined();
  });

  it('passes errors without a response to the fallback error handler', async () => {
    const networkError = new AxiosError('Network Error', 'ERR_NETWORK');
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      networkError.config = config as any;
      throw networkError;
    });
    const fallbackHandler = jest.fn(async () => 'recovered');

    const instance = axiosInstanceFactory<string>({
      headerSetters: {},
      errorHandlers: { 0: fallbackHandler },
      beforeRetryHandlers: {},
      axiosConfigOverride: { adapter, retry: 0 } as AxiosRequestConfig,
    });

    await expect(instance.get('https://example.test')).resolves.toBe(
      'recovered',
    );
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(fallbackHandler).toHaveBeenCalledWith(networkError, undefined);
  });
});

function okResponse(config: any, data: any = 'ok') {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function failWith(config: any, status: number) {
  const response = {
    data: null,
    status,
    statusText: 'ERR',
    headers: {},
    config,
  };
  return new AxiosError(
    `status ${status}`,
    'ERR_BAD_RESPONSE',
    config,
    null,
    response as any,
  );
}

describe('axiosInstanceFactory (hermetic)', () => {
  it('uses the default retry config when no override is given', () => {
    const instance = axiosInstanceFactory({
      headerSetters: {},
      errorHandlers: {},
      beforeRetryHandlers: {},
    });

    expect((instance.defaults as any).retry).toBe(3);
    expect((instance.defaults as any).retryDelay).toBe(1000);
  });

  it('sets headers from headerSetters on every request', async () => {
    const adapter = jest.fn(async (config: any) => okResponse(config));
    const tokenSetter = jest.fn(() => 'Bearer abc');

    const instance = axiosInstanceFactory({
      headerSetters: { Authorization: tokenSetter, 'X-Static': () => 'static' },
      errorHandlers: {},
      beforeRetryHandlers: {},
      axiosConfigOverride: { adapter },
    });

    await instance.get('https://example.test/a');

    const sent = adapter.mock.calls[0][0];
    expect(sent.headers.Authorization).toBe('Bearer abc');
    expect(sent.headers['X-Static']).toBe('static');
    expect(tokenSetter).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.test/a' }),
    );
  });

  it('prefers the status-specific error handler over the fallback', async () => {
    const adapter = jest.fn(async (config: any) => {
      throw failWith(config, 404);
    });
    const on404 = jest.fn(async () => 'not-found');
    const fallback = jest.fn(async () => 'fallback');

    const instance = axiosInstanceFactory<string>({
      headerSetters: {},
      errorHandlers: { 404: on404, 0: fallback },
      beforeRetryHandlers: {},
      axiosConfigOverride: { adapter, retry: 0 } as AxiosRequestConfig,
    });

    await expect(instance.get('https://example.test')).resolves.toBe(
      'not-found',
    );
    expect(on404).toHaveBeenCalledWith(
      expect.any(AxiosError),
      expect.objectContaining({ status: 404 }),
    );
    expect(fallback).not.toHaveBeenCalled();
  });

  it('uses the fallback handler for statuses without a specific handler', async () => {
    const adapter = jest.fn(async (config: any) => {
      throw failWith(config, 500);
    });
    const fallback = jest.fn(async () => 'fallback');

    const instance = axiosInstanceFactory<string>({
      headerSetters: {},
      errorHandlers: { 404: jest.fn(), 0: fallback },
      beforeRetryHandlers: {},
      axiosConfigOverride: { adapter, retry: 0 } as AxiosRequestConfig,
    });

    await expect(instance.get('https://example.test')).resolves.toBe(
      'fallback',
    );
  });

  it('rejects with the original error when no handler applies', async () => {
    let thrown: AxiosError | undefined;
    const adapter = jest.fn(async (config: any) => {
      thrown = failWith(config, 500);
      throw thrown;
    });

    const instance = axiosInstanceFactory({
      headerSetters: {},
      errorHandlers: {},
      beforeRetryHandlers: {},
      axiosConfigOverride: { adapter, retry: 0 } as AxiosRequestConfig,
    });

    const error = await instance.get('https://example.test').catch((e) => e);
    expect(error).toBe(thrown);
  });

  it('retries failed requests, calling the before-retry handler, until one succeeds', async () => {
    const adapter = jest
      .fn()
      .mockImplementationOnce(async (config: any) => {
        throw failWith(config, 503);
      })
      .mockImplementationOnce(async (config: any) =>
        okResponse(config, 'second time lucky'),
      );
    const before503 = jest.fn(async () => '');
    const beforeAny = jest.fn(async () => '');
    const onError = jest.fn();

    const instance = axiosInstanceFactory<string>({
      headerSetters: {},
      errorHandlers: { 0: onError },
      beforeRetryHandlers: { 503: before503, 0: beforeAny },
      axiosConfigOverride: {
        adapter,
        retry: 2,
        retryDelay: 1,
      } as AxiosRequestConfig,
    });

    const response = await instance.get('https://example.test');

    expect(response.data).toBe('second time lucky');
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(before503).toHaveBeenCalledTimes(1);
    expect(beforeAny).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('gives up after the configured number of retries and hands off to the error handler', async () => {
    const adapter = jest.fn(async (config: any) => {
      throw failWith(config, 500);
    });
    const beforeRetry = jest.fn(async () => '');
    const fallback = jest.fn(async () => 'gave up');

    const instance = axiosInstanceFactory<string>({
      headerSetters: {},
      errorHandlers: { 0: fallback },
      beforeRetryHandlers: { 0: beforeRetry },
      axiosConfigOverride: {
        adapter,
        retry: 2,
        retryDelay: 1,
      } as AxiosRequestConfig,
    });

    await expect(instance.get('https://example.test')).resolves.toBe('gave up');
    expect(adapter).toHaveBeenCalledTimes(3);
    expect(beforeRetry).toHaveBeenCalledTimes(2);
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it('waits retryDelay milliseconds (default 1000) before retrying', async () => {
    jest.useFakeTimers();
    try {
      const adapter = jest
        .fn()
        .mockImplementationOnce(async (config: any) => {
          throw failWith(config, 500);
        })
        .mockImplementationOnce(async (config: any) => okResponse(config));

      const instance = axiosInstanceFactory({
        headerSetters: {},
        errorHandlers: {},
        beforeRetryHandlers: {},
        axiosConfigOverride: {
          adapter,
          retry: 1,
          retryDelay: 0,
        } as AxiosRequestConfig,
      });

      const pending = instance.get('https://example.test');

      await jest.advanceTimersByTimeAsync(999);
      expect(adapter).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual(
        expect.objectContaining({ status: 200 }),
      );
      expect(adapter).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});
