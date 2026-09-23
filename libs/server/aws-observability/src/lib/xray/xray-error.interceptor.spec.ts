import {
  BadRequestException,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import * as AWSXRay from 'aws-xray-sdk-core';
import { lastValueFrom, throwError } from 'rxjs';
import { XrayErrorInterceptor } from './xray-error.interceptor';

const addError = jest.fn();
const segment = { addError };

jest.mock('aws-xray-sdk-core', () => ({
  getSegment: jest.fn(),
  isAutomaticMode: jest.fn(() => true),
  getNamespace: jest.fn(),
}));

describe('XrayErrorInterceptor', () => {
  const interceptor = new XrayErrorInterceptor();
  const context = {} as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    (AWSXRay.getNamespace as jest.Mock).mockReturnValue({ get: () => segment });
    (AWSXRay.getSegment as jest.Mock).mockReturnValue(segment);
  });

  async function intercept(error: Error): Promise<void> {
    await expect(
      lastValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => error),
        }),
      ),
    ).rejects.toBe(error);
  }

  it('records server errors as segment faults', async () => {
    const error = new InternalServerErrorException();
    await intercept(error);

    expect(addError).toHaveBeenCalledWith(error);
  });

  it('records unknown errors as segment faults', async () => {
    const error = new Error('boom');
    await intercept(error);

    expect(addError).toHaveBeenCalledWith(error);
  });

  it('does not record client errors as faults', async () => {
    await intercept(new BadRequestException());

    expect(addError).not.toHaveBeenCalled();
  });

  it('does not touch X-Ray when no segment is active', async () => {
    (AWSXRay.getNamespace as jest.Mock).mockReturnValue({
      get: () => undefined,
    });
    await intercept(new Error('boom'));

    expect(AWSXRay.getSegment).not.toHaveBeenCalled();
    expect(addError).not.toHaveBeenCalled();
  });
});
