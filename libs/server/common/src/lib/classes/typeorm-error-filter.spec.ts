import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { EntityPropertyNotFoundError, QueryFailedError } from 'typeorm';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';
import { TypeormErrorFilter } from './typeorm-error-filter';

function createHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function queryFailed(message: string) {
  return new QueryFailedError('select 1', [], new Error(message));
}

describe('TypeormErrorFilter', () => {
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerError.mockRestore();
  });

  it('maps a "null value" QueryFailedError to 400 NullValue', () => {
    const { host, status, json } = createHost();
    const error = queryFailed(
      'null value in column "name" violates not-null constraint',
    );

    new TypeormErrorFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      `QueryFailedError.NullValue: ${error.message}`,
    );
    expect(loggerError).toHaveBeenCalledWith(error.message);
  });

  it('maps a "duplicate key" QueryFailedError to 409 DuplicateKey', () => {
    const { host, status, json } = createHost();
    const error = queryFailed(
      'duplicate key value violates unique constraint "pk"',
    );

    new TypeormErrorFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      `QueryFailedError.DuplicateKey: ${error.message}`,
    );
  });

  it('maps EntityNotFoundError to 404', () => {
    const { host, status, json } = createHost();
    const error = new EntityNotFoundError('User', { id: 1 });

    new TypeormErrorFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(`EntityNotFoundError: ${error.message}`);
  });

  it('maps EntityPropertyNotFoundError to 400', () => {
    const { host, status, json } = createHost();
    const error = new EntityPropertyNotFoundError('missing', {
      name: 'User',
    } as any);

    new TypeormErrorFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      `EntityPropertyNotFoundError: ${error.message}`,
    );
  });

  it('labels a QueryFailedError that matches no discriminator generically', () => {
    const { host, status, json } = createHost();
    const error = queryFailed('syntax error at or near "selec"');

    new TypeormErrorFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(`QueryFailedError: ${error.message}`);
  });
});
