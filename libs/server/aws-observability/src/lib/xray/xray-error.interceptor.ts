import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { activeXraySegment } from './active-xray-segment.function';

@Injectable()
export class XrayErrorInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        // addError() flags the segment as a fault (5xx). Client errors are
        // flagged as errors from the response status when the segment closes.
        const isClientError =
          error instanceof HttpException && error.getStatus() < 500;
        const segment = isClientError ? undefined : activeXraySegment();
        if (segment && error instanceof Error) {
          segment.addError(error);
        }
        return throwError(() => error);
      }),
    );
  }
}
