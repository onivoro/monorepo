import { ArgumentsHost, Catch, ExceptionFilter, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';

@Catch(InternalServerErrorException)
export class ErrorFilter implements ExceptionFilter {
  catch(error: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    console.error({ message: error.message });
    response.status(500).send(error.message || 'InternalServerError');
  }
}
