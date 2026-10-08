import { sleep } from './sleep.function';

describe('sleep', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves after the given number of milliseconds', async () => {
    const done = jest.fn();
    const promise = sleep(1000).then(done);

    await jest.advanceTimersByTimeAsync(999);
    expect(done).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await promise;
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('defaults to zero milliseconds', async () => {
    const promise = sleep();
    await jest.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBeUndefined();
  });
});
