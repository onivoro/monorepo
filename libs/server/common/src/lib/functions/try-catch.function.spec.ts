import { InternalServerErrorException } from '@nestjs/common';
import { tryCatch } from './try-catch.function';

describe('tryCatch', () => {
  it('resolves with the function result', async () => {
    await expect(tryCatch(async () => 42)).resolves.toBe(42);
  });

  it('wraps a rejection in InternalServerErrorException with its message', async () => {
    await expect(
      tryCatch(async () => {
        throw new Error('db down');
      }),
    ).rejects.toThrow(new InternalServerErrorException('db down'));
  });

  it('uses a default message when the error has none', async () => {
    await expect(
      tryCatch(async () => {
        throw {};
      }),
    ).rejects.toThrow(
      new InternalServerErrorException(
        'Unknown error encountered processing the request',
      ),
    );
  });
});
