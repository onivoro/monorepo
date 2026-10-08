import { AxiosError } from 'axios';
import { createAxiosInstance } from './create-axios-instance.function';
import { TApiConfig } from '../types/api-config.type';

// Hermetic counterpart to create-axios-instance.function.spec.ts (which hits
// the network): every request goes through a stubbed adapter.

const URL = 'https://example.test/things/1';

function okResponse(config: any, data: any = { id: 1 }) {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function failWith(config: any, status?: number) {
  const response = status
    ? {
        data: { message: 'nope' },
        status,
        statusText: 'ERR',
        headers: {},
        config,
      }
    : undefined;
  return new AxiosError(
    'failed',
    'ERR_BAD_RESPONSE',
    config,
    null,
    response as any,
  );
}

function stubbed(config: TApiConfig, adapter: jest.Mock) {
  const instance = createAxiosInstance(config);
  instance.defaults.adapter = adapter;
  return instance;
}

describe('createAxiosInstance (hermetic)', () => {
  describe('requests', () => {
    it('adds headers from addHeaders and calls onRequest with the outgoing request', async () => {
      const adapter = jest.fn(async (config: any) => okResponse(config));
      const addHeaders = jest.fn(() => ({
        'X-Custom': 'v',
        Authorization: 'Bearer t',
      }));
      const onRequest = jest.fn();

      const instance = stubbed({ apiUrl: URL, addHeaders, onRequest }, adapter);
      await instance.get(URL);

      const sent = adapter.mock.calls[0][0];
      expect(sent.headers['X-Custom']).toBe('v');
      expect(sent.headers.Authorization).toBe('Bearer t');
      expect(addHeaders).toHaveBeenCalledWith(
        expect.objectContaining({ url: URL, method: 'get' }),
      );
      expect(onRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: URL, method: 'get' }),
      );
    });

    it('tolerates addHeaders returning nothing', async () => {
      const adapter = jest.fn(async (config: any) => okResponse(config));
      const instance = stubbed(
        {
          apiUrl: URL,
          addHeaders: () => undefined as unknown as Record<string, string>,
        },
        adapter,
      );

      await expect(instance.get(URL)).resolves.toEqual(
        expect.objectContaining({ status: 200 }),
      );
    });

    it('calls onRequest before onResponse', async () => {
      const order: string[] = [];
      const adapter = jest.fn(async (config: any) => okResponse(config));
      const instance = stubbed(
        {
          apiUrl: URL,
          onRequest: () => order.push('request'),
          onResponse: () => order.push('response'),
        },
        adapter,
      );

      await instance.get(URL);
      expect(order).toEqual(['request', 'response']);
    });
  });

  describe('responses', () => {
    it('passes successful responses to onResponse and returns them', async () => {
      const adapter = jest.fn(async (config: any) =>
        okResponse(config, { id: 7 }),
      );
      const onResponse = jest.fn();

      const instance = stubbed({ apiUrl: URL, onResponse }, adapter);
      const response = await instance.get(URL);

      expect(response.data).toEqual({ id: 7 });
      expect(onResponse).toHaveBeenCalledWith(
        expect.objectContaining({ status: 200, data: { id: 7 } }),
      );
    });

    it('keeps handlers isolated between instances', async () => {
      const adapter = jest.fn(async (config: any) => okResponse(config));
      const a = jest.fn();
      const b = jest.fn();

      await stubbed({ apiUrl: URL, onResponse: a }, adapter).get(URL);
      await stubbed({ apiUrl: URL, onResponse: b }, adapter).get(URL);

      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  describe('errors', () => {
    it('rethrows by default after calling onError and the status handler', async () => {
      let thrown: AxiosError | undefined;
      const adapter = jest.fn(async (config: any) => {
        thrown = failWith(config, 404);
        throw thrown;
      });
      const onError = jest.fn();
      const on404 = jest.fn();
      const on400 = jest.fn();
      const onResponse = jest.fn();

      const instance = stubbed(
        { apiUrl: URL, onError, on404, on400, onResponse },
        adapter,
      );
      const error = await instance.get(URL).catch((e) => e);

      expect(error).toBe(thrown);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
      expect(on404).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404 }),
      );
      expect(on400).not.toHaveBeenCalled();
      expect(onResponse).not.toHaveBeenCalled();
    });

    it('swallows errors when swallowErrors is true, resolving undefined', async () => {
      const adapter = jest.fn(async (config: any) => {
        throw failWith(config, 500);
      });
      const onError = jest.fn();
      const on500 = jest.fn();

      const instance = stubbed(
        { apiUrl: URL, onError, on500, swallowErrors: true },
        adapter,
      );

      await expect(instance.get(URL)).resolves.toBeUndefined();
      expect(onError).toHaveBeenCalledTimes(1);
      expect(on500).toHaveBeenCalledTimes(1);
    });

    it('passes a default error object to onError when there is no response', async () => {
      const adapter = jest.fn(async (config: any) => {
        throw failWith(config);
      });
      const onError = jest.fn();

      const instance = stubbed({ apiUrl: URL, onError }, adapter);

      await expect(instance.get(URL)).rejects.toBeInstanceOf(AxiosError);
      expect(onError).toHaveBeenCalledWith({ config: {} });
    });

    it('ignores status handlers that are not functions', async () => {
      const adapter = jest.fn(async (config: any) => {
        throw failWith(config, 418);
      });

      const instance = stubbed(
        { apiUrl: URL, on418: 'not a function' as any, swallowErrors: true },
        adapter,
      );

      await expect(instance.get(URL)).resolves.toBeUndefined();
    });
  });
});
