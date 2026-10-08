import { ArgumentsHost } from '@nestjs/common';
import { ErrorFilter } from './error-filter';

function createHost() {
  const send = jest.fn();
  const status = jest.fn().mockReturnValue({ send });
  const response = { status };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, status, send };
}

describe('ErrorFilter', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('responds 500 with the error message and logs it', () => {
    const { host, status, send } = createHost();

    new ErrorFilter().catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith('boom');
    expect(consoleError).toHaveBeenCalledWith({ message: 'boom' });
  });

  it('falls back to "InternalServerError" when the error has no message', () => {
    const { host, status, send } = createHost();

    new ErrorFilter().catch(new Error(''), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith('InternalServerError');
  });
});
