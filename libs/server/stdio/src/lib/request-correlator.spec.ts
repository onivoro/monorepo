import { RequestCorrelator } from './request-correlator';

describe('RequestCorrelator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hands out sequential string ids and tracks them as pending', () => {
    const correlator = new RequestCorrelator();

    const a = correlator.createRequest();
    const b = correlator.createRequest();

    expect(a.id).toBe('1');
    expect(b.id).toBe('2');
    expect(correlator.pendingCount).toBe(2);
    expect(correlator.hasPending('1')).toBe(true);
    expect(correlator.hasPending('3')).toBe(false);
    correlator.cancelAll();
    return Promise.allSettled([a.promise, b.promise]);
  });

  it('resolves a pending request and forgets it', async () => {
    const correlator = new RequestCorrelator<string>();
    const { id, promise } = correlator.createRequest();

    expect(correlator.resolve(id, 'done')).toBe(true);

    await expect(promise).resolves.toBe('done');
    expect(correlator.hasPending(id)).toBe(false);
    expect(correlator.pendingCount).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects a pending request and forgets it', async () => {
    const correlator = new RequestCorrelator();
    const { id, promise } = correlator.createRequest();
    const error = new Error('bad');

    expect(correlator.reject(id, error)).toBe(true);

    await expect(promise).rejects.toBe(error);
    expect(correlator.pendingCount).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('returns false when resolving or rejecting an unknown id', () => {
    const correlator = new RequestCorrelator();

    expect(correlator.resolve('nope', 1)).toBe(false);
    expect(correlator.reject('nope', new Error('x'))).toBe(false);
  });

  it('only settles a request once', async () => {
    const correlator = new RequestCorrelator<number>();
    const { id, promise } = correlator.createRequest();

    expect(correlator.resolve(id, 1)).toBe(true);
    expect(correlator.resolve(id, 2)).toBe(false);
    expect(correlator.reject(id, new Error('late'))).toBe(false);

    await expect(promise).resolves.toBe(1);
  });

  it('times out after the default timeout', async () => {
    const correlator = new RequestCorrelator(1000);
    const { id, promise } = correlator.createRequest();

    jest.advanceTimersByTime(999);
    expect(correlator.hasPending(id)).toBe(true);

    jest.advanceTimersByTime(1);
    await expect(promise).rejects.toThrow('Request 1 timed out after 1000ms');
    expect(correlator.hasPending(id)).toBe(false);
    expect(correlator.resolve(id, 'late')).toBe(false);
  });

  it('defaults to a 30 second timeout', async () => {
    const correlator = new RequestCorrelator();
    const { promise } = correlator.createRequest();

    jest.advanceTimersByTime(30000);
    await expect(promise).rejects.toThrow('timed out after 30000ms');
  });

  it('lets a request override the default timeout', async () => {
    const correlator = new RequestCorrelator(1000);
    const { promise } = correlator.createRequest(50);

    jest.advanceTimersByTime(50);
    await expect(promise).rejects.toThrow('timed out after 50ms');
  });

  it.each([0, -1])('never times out with a timeout of %i', (timeout) => {
    const correlator = new RequestCorrelator(timeout);
    const { id } = correlator.createRequest();

    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(1_000_000);
    expect(correlator.hasPending(id)).toBe(true);
    correlator.resolve(id, undefined);
  });

  it('cancelAll rejects every pending request with the given error', async () => {
    const correlator = new RequestCorrelator();
    const a = correlator.createRequest();
    const b = correlator.createRequest(0);
    const error = new Error('stopped');

    correlator.cancelAll(error);

    await expect(a.promise).rejects.toBe(error);
    await expect(b.promise).rejects.toBe(error);
    expect(correlator.pendingCount).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancelAll uses a default error', async () => {
    const correlator = new RequestCorrelator();
    const { promise } = correlator.createRequest();

    correlator.cancelAll();

    await expect(promise).rejects.toThrow('All requests cancelled');
  });
});
