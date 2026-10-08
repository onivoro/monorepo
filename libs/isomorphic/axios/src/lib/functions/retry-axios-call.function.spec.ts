import { retryAxiosCall } from './retry-axios-call.function';

describe('retryAxiosCall', () => {
  afterEach(() => jest.useRealTimers());

  it('rejects with the error when it has no config', async () => {
    const err = new Error('no config');
    const instance = jest.fn();

    await expect(retryAxiosCall(err, instance as any)).rejects.toBe(err);
    expect(instance).not.toHaveBeenCalled();
  });

  it('decrements retry, waits retryDelay, then re-issues the request', async () => {
    jest.useFakeTimers();
    const config = { url: '/x', retry: 2, retryDelay: 250 };
    const instance = jest.fn(async () => 'response');

    const pending = retryAxiosCall({ config }, instance as any);

    await jest.advanceTimersByTimeAsync(249);
    expect(instance).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe('response');
    expect(instance).toHaveBeenCalledWith(config);
    expect(config.retry).toBe(1);
  });

  it('resets a missing/zero retry count to the default before decrementing, and defaults the delay to 1000ms', async () => {
    jest.useFakeTimers();
    const config: any = { url: '/x' };
    const instance = jest.fn(async () => 'ok');

    const pending = retryAxiosCall({ config }, instance as any);

    await jest.advanceTimersByTimeAsync(999);
    expect(instance).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toBe('ok');
    expect(config.retry).toBe(2);
  });

  it('propagates a rejection from the re-issued request', async () => {
    const config = { retry: 1, retryDelay: 1 };
    const instance = jest.fn(async () => {
      throw new Error('still failing');
    });

    await expect(retryAxiosCall({ config }, instance as any)).rejects.toThrow(
      'still failing',
    );
  });
});
