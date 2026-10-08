import { BadRequestException } from '@nestjs/common';
import { ParseDateOptionalPipe } from './parse-date-optional.pipe';

const metadata = { type: 'query' } as const;

describe('ParseDateOptionalPipe', () => {
  it.each([undefined, null, ''])(
    'passes through empty value %p',
    async (value) => {
      await expect(
        new ParseDateOptionalPipe(true).transform(value, metadata),
      ).resolves.toBe(value);
    },
  );

  it('returns the original string when parse is false', async () => {
    await expect(
      new ParseDateOptionalPipe(false).transform('2024-05-06', metadata),
    ).resolves.toBe('2024-05-06');
  });

  it('returns a Date when parse is true', async () => {
    const result = await new ParseDateOptionalPipe(true).transform(
      '2024-05-06',
      metadata,
    );
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).toISOString()).toBe('2024-05-06T00:00:00.000Z');
  });

  it('rejects values not shaped like YYYY-MM-DD', async () => {
    await expect(
      new ParseDateOptionalPipe(true).transform('05/06/2024', metadata),
    ).rejects.toThrow(
      new BadRequestException('"05/06/2024" does not conform to YYYY-MM-DD'),
    );
  });

  it('rejects well-shaped strings that are not real dates', async () => {
    await expect(
      new ParseDateOptionalPipe(true).transform('2024-13-01', metadata),
    ).rejects.toThrow(
      new BadRequestException('"2024-13-01" does not represent a valid date'),
    );
  });

  it.each(['2024-02-30', '2023-02-29', '2024-04-31'])(
    'rejects impossible calendar date %p',
    async (value) => {
      await expect(
        new ParseDateOptionalPipe(true).transform(value, metadata),
      ).rejects.toThrow(
        new BadRequestException(`"${value}" does not represent a valid date`),
      );
    },
  );

  it('accepts a leap day in a leap year', async () => {
    const result = await new ParseDateOptionalPipe(true).transform(
      '2024-02-29',
      metadata,
    );
    expect((result as Date).toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });
});
