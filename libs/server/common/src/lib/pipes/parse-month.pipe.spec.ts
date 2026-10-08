import { BadRequestException } from '@nestjs/common';
import { ParseMonthPipe } from './parse-month.pipe';

const metadata = { type: 'query' } as const;

describe('ParseMonthPipe', () => {
  it.each([
    ['1', 1],
    ['12', 12],
    [7, 7],
  ])('converts %p to %p', async (input, expected) => {
    await expect(new ParseMonthPipe().transform(input, metadata)).resolves.toBe(
      expected,
    );
  });

  it.each([undefined, '', '0', 'abc'])(
    'requires a value (%p)',
    async (input) => {
      await expect(
        new ParseMonthPipe().transform(input, metadata),
      ).rejects.toThrow(new BadRequestException('month is required'));
    },
  );

  it('rejects values below 1', async () => {
    await expect(
      new ParseMonthPipe().transform('-1', metadata),
    ).rejects.toThrow('month must be greater than or equal to 1');
  });

  it('rejects values above 12', async () => {
    await expect(
      new ParseMonthPipe().transform('13', metadata),
    ).rejects.toThrow('month must be less than or equal to 12');
  });

  it('uses the custom property name in messages', async () => {
    await expect(
      new ParseMonthPipe('startMonth').transform('', metadata),
    ).rejects.toThrow('startMonth is required');
  });
});
