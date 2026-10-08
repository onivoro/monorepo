import { mapEntitiesToOptions } from './map-entities-to-options.function';

const entities = {
  a: { id: 'a', name: 'Alpha' },
  b: { id: 'b', name: '' },
  c: { id: 'c' },
};

describe('mapEntitiesToOptions', () => {
  it('maps ids to options, preceded by a blank option by default', () => {
    expect(mapEntitiesToOptions(entities, ['a', 'c'])).toEqual([
      { display: '', value: '' },
      { value: 'a', display: 'Alpha' },
      { value: 'c', display: 'c' },
    ]);
  });

  it('falls back to the id when the name is empty', () => {
    expect(mapEntitiesToOptions(entities, ['b'], false)).toEqual([
      { value: 'b', display: 'b' },
    ]);
  });

  it('omits the blank option when includeBlank is false', () => {
    expect(mapEntitiesToOptions(entities, ['a'], false)).toEqual([
      { value: 'a', display: 'Alpha' },
    ]);
  });

  it.each([[[]], [undefined], [null]])('handles empty ids %p', (ids) => {
    expect(mapEntitiesToOptions(entities, ids as unknown as string[])).toEqual([
      { display: '', value: '' },
    ]);
    expect(
      mapEntitiesToOptions(entities, ids as unknown as string[], false),
    ).toEqual([]);
  });
});
