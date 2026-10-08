import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const metadata = { type: 'body' } as const;

describe('ZodValidationPipe', () => {
  const schema = z.object({ name: z.string(), age: z.coerce.number() });

  it('returns the parsed data on success', () => {
    expect(
      new ZodValidationPipe(schema).transform(
        { name: 'a', age: '3' },
        metadata,
      ),
    ).toEqual({
      name: 'a',
      age: 3,
    });
  });

  it('throws BadRequestException carrying the zod issues on failure', () => {
    let caught: unknown;
    try {
      new ZodValidationPipe(schema).transform({ name: 1, age: 2 }, metadata);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse() as any;
    expect(response.statusCode).toBe(400);
    expect(response.message).toHaveLength(1);
    expect(response.message[0]).toMatchObject({
      code: 'invalid_type',
      path: ['name'],
    });
  });

  it('falls back to "Validation failed" when the error cannot be parsed as JSON', () => {
    const fakeSchema = {
      safeParse: () => ({ success: false, error: 'not json' }),
    } as unknown as z.ZodType<any>;

    expect(() =>
      new ZodValidationPipe(fakeSchema).transform({}, metadata),
    ).toThrow(new BadRequestException('Validation failed'));
  });
});
