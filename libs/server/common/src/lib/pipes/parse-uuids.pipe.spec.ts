import { BadRequestException } from '@nestjs/common';
import { ParseUUIDsPipe } from './parse-uuids.pipe';

const metadata = { type: 'body' } as const;
const a = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const b = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('ParseUUIDsPipe', () => {
  describe('without a property', () => {
    it('returns the array when every entry is a v4 UUID', () => {
      expect(new ParseUUIDsPipe().transform([a, b], metadata)).toEqual([a, b]);
    });

    it('accepts an empty array', () => {
      expect(new ParseUUIDsPipe().transform([], metadata)).toEqual([]);
    });

    it('rejects a non-array body', () => {
      expect(() => new ParseUUIDsPipe().transform(a, metadata)).toThrow(
        new BadRequestException('Expected an array of UUIDs.'),
      );
    });

    it('lists the invalid entries', () => {
      expect(() =>
        new ParseUUIDsPipe().transform([a, 'x', 'y'], metadata),
      ).toThrow('Invalid UUID(s): x, y');
    });
  });

  describe('with a property', () => {
    it('validates the named property and returns the body', () => {
      const body = { ids: [a, b], other: 1 };
      expect(new ParseUUIDsPipe('ids').transform(body, metadata)).toEqual(body);
    });

    it('rejects when the property is not an array', () => {
      expect(() =>
        new ParseUUIDsPipe('ids').transform({ ids: a }, metadata),
      ).toThrow('Expected an array of UUIDs.');
    });

    it('names the property in the invalid-UUID message', () => {
      expect(() =>
        new ParseUUIDsPipe('ids').transform({ ids: ['bad'] }, metadata),
      ).toThrow('Invalid UUID(s) for "ids": bad');
    });
  });
});
