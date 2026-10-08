import { ParseUUIDOptionalPipe } from './parse-uuid-optional.pipe';

const metadata = { type: 'param', data: 'id' } as const;
const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('ParseUUIDOptionalPipe', () => {
  it.each([undefined, null, ''])(
    'returns undefined for empty value %p',
    async (value) => {
      await expect(
        new ParseUUIDOptionalPipe().transform(value, metadata),
      ).resolves.toBeUndefined();
    },
  );

  it('returns a valid v4 UUID unchanged', async () => {
    await expect(
      new ParseUUIDOptionalPipe().transform(uuid, metadata),
    ).resolves.toBe(uuid);
  });

  it('rejects a non-UUID value', async () => {
    await expect(
      new ParseUUIDOptionalPipe().transform('not-a-uuid', metadata),
    ).rejects.toThrow(/uuid/i);
  });

  it('rejects a UUID that is not version 4', async () => {
    await expect(
      new ParseUUIDOptionalPipe().transform(
        '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
        metadata,
      ),
    ).rejects.toThrow(/uuid/i);
  });
});
