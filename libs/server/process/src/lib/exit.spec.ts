import { exit } from './exit';

describe('exit', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns a callback that calls process.exit with the bound code', () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as any);

    const callback = exit(3);
    expect(exitSpy).not.toHaveBeenCalled();

    callback();

    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy.mock.calls[0][0]).toBe(3);
  });
});
