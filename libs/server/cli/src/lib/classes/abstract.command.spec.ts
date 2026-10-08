import { AbstractCommand } from './abstract.command';

class TestCommand extends AbstractCommand<{ name: string }> {
  constructor(
    private readonly impl: (
      args: string[],
      params: { name: string },
    ) => Promise<void>,
  ) {
    super('test');
  }

  main(args: string[], params: { name: string }) {
    return this.impl(args, params);
  }
}

describe('AbstractCommand', () => {
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as any);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps the name it was constructed with', () => {
    expect(new TestCommand(async () => undefined).name).toBe('test');
  });

  it('passes args and params to main and exits 0 on success', async () => {
    const impl = jest.fn().mockResolvedValue(undefined);

    await new TestCommand(impl).run(['a', 'b'], { name: 'n' });

    expect(impl).toHaveBeenCalledWith(['a', 'b'], { name: 'n' });
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs the error and exits 1 when main rejects', async () => {
    const error = new Error('boom');

    await new TestCommand(() => Promise.reject(error)).run([], { name: 'n' });

    expect(errorSpy).toHaveBeenCalledWith({ error });
    expect(exitSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
