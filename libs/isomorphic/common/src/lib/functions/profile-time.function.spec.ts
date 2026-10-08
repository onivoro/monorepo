import { profileTime } from './profile-time.function';

describe('profileTime', () => {
  let log: jest.SpyInstance;
  let now: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    now = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(3500);
  });

  afterEach(() => {
    log.mockRestore();
    now.mockRestore();
  });

  it('returns the resolved value and logs start, end and elapsed seconds', async () => {
    const fn = async () => 'value';

    await expect(profileTime(fn)).resolves.toBe('value');

    expect(log).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenNthCalledWith(1, {
      PROFILE_TIME: 'PROFILE_TIME',
      fn: fn.toString(),
      start: 1000,
    });
    expect(log).toHaveBeenNthCalledWith(2, {
      PROFILE_TIME: 'PROFILE_TIME',
      fn: fn.toString(),
      end: 3500,
      elapsed: 2.5,
    });
  });

  it('propagates rejections without logging the end', async () => {
    await expect(
      profileTime(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(log).toHaveBeenCalledTimes(1);
  });
});
