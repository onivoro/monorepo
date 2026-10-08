import { createApi } from './create-api.function';
import { TApiConfig } from '../types/api-config.type';

class FakeApi {
  constructor(
    public readonly configuration: any,
    public readonly basePath: string,
    public readonly axios: any,
  ) {}
}

describe('createApi', () => {
  it('constructs the api with {basePath}, the base path and an axios instance', () => {
    const config: TApiConfig = { apiUrl: 'https://api.example.test' };

    const api = createApi(FakeApi, config);

    expect(api).toBeInstanceOf(FakeApi);
    expect(api.configuration).toEqual({ basePath: 'https://api.example.test' });
    expect(api.basePath).toBe('https://api.example.test');
    expect(typeof api.axios.get).toBe('function');
    expect(typeof api.axios.interceptors.request.use).toBe('function');
  });

  it('wires the config handlers into the axios instance', async () => {
    const onResponse = jest.fn();
    const api = createApi(FakeApi, {
      apiUrl: 'https://api.example.test',
      onResponse,
    });

    api.axios.defaults.adapter = async (config: any) => ({
      data: 'x',
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });

    await api.axios.get('/anything');
    expect(onResponse).toHaveBeenCalledWith(
      expect.objectContaining({ data: 'x' }),
    );
  });
});
