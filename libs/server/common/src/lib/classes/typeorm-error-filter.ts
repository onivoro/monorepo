import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Logger } from '@nestjs/common';
import { EntityPropertyNotFoundError, QueryFailedError } from 'typeorm';
import { EntityNotFoundError } from 'typeorm/error/EntityNotFoundError';

const mappings = {
  default: {
    type: QueryFailedError,
    status: HttpStatus.BAD_REQUEST,
    message: 'QueryFailedError.NullValue',
    discriminator: 'null value',
  },
  unique: {
    type: QueryFailedError,
    status: HttpStatus.CONFLICT,
    message: 'QueryFailedError.DuplicateKey',
    discriminator: 'duplicate key',
  },
  notFound: {
    type: EntityNotFoundError,
    status: HttpStatus.NOT_FOUND,
    message: 'EntityNotFoundError',
    discriminator: null,
  },
  bad: {
    type: EntityPropertyNotFoundError,
    status: HttpStatus.BAD_REQUEST,
    message: 'EntityPropertyNotFoundError',
    discriminator: null,
  }
};

@Catch(...Object.values(mappings).map((v) => v.type))
export class TypeormErrorFilter implements ExceptionFilter {
  private logger = new Logger('TypeormErrorFilter');

  catch(error: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const mapping =
      Object.values(mappings).find(({ type, discriminator }) =>
        type.name.startsWith(error.name) && !(discriminator && !error.message?.includes(discriminator))) ?? mappings.default;

    this.logger.error(error.message);
    response.status(mapping.status).json(`${mapping.message}: ${error.message}`);
  }
}
