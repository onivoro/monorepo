import { BadRequestException } from '@nestjs/common';
import { ParseYearPipe } from './parse-year.pipe';

const metadata = { type: 'query' } as const;

describe('ParseYearPipe', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['2024', 2024],
    ['2026', 2026],
  ])('converts %p to %p', async (input, expected) => {
    await expect(new ParseYearPipe().transform(input, metadata)).resolves.toBe(
      expected,
    );
  });

  it.each([undefined, '', '0', 'x'])('requires a value (%p)', async (input) => {
    await expect(
      new ParseYearPipe().transform(input, metadata),
    ).rejects.toThrow(new BadRequestException('year is required'));
  });

  it('rejects years below the default minimum of 2024', async () => {
    await expect(
      new ParseYearPipe().transform('2023', metadata),
    ).rejects.toThrow('year must be greater than or equal to 2024');
  });

  it('rejects years after the current UTC year', async () => {
    await expect(
      new ParseYearPipe().transform('2027', metadata),
    ).rejects.toThrow('year must be less than or equal to 2026');
  });

  it('honours a custom property name and minimum year', async () => {
    const pipe = new ParseYearPipe('fiscalYear', 2000);
    await expect(pipe.transform('2001', metadata)).resolves.toBe(2001);
    await expect(pipe.transform('1999', metadata)).rejects.toThrow(
      'fiscalYear must be greater than or equal to 2000',
    );
  });
});
