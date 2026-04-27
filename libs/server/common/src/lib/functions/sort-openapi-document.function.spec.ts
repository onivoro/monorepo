import { sortOpenApiDocument } from './sort-openapi-document.function';

describe('sortOpenApiDocument', () => {
  it('sorts object keys alphabetically at every depth', () => {
    const input = {
      paths: {
        '/b': { get: { summary: 'b' } },
        '/a': { get: { summary: 'a' } },
      },
      info: { version: '1', title: 't' },
      openapi: '3.0.0',
    };

    const sorted = sortOpenApiDocument(input);

    expect(Object.keys(sorted)).toEqual(['info', 'openapi', 'paths']);
    expect(Object.keys((sorted as any).info)).toEqual(['title', 'version']);
    expect(Object.keys((sorted as any).paths)).toEqual(['/a', '/b']);
  });

  it('sorts components.schemas and their properties', () => {
    const input = {
      components: {
        schemas: {
          Zebra: { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } } },
          Apple: { type: 'object', properties: { color: { type: 'string' }, bitter: { type: 'boolean' } } },
        },
      },
    };

    const sorted = sortOpenApiDocument(input) as any;

    expect(Object.keys(sorted.components.schemas)).toEqual(['Apple', 'Zebra']);
    expect(Object.keys(sorted.components.schemas.Apple.properties)).toEqual(['bitter', 'color']);
    expect(Object.keys(sorted.components.schemas.Zebra.properties)).toEqual(['age', 'name']);
  });

  it('sorts tags array by name', () => {
    const input = {
      tags: [
        { name: 'zeta', description: 'z' },
        { name: 'alpha', description: 'a' },
        { name: 'mu', description: 'm' },
      ],
    };

    const sorted = sortOpenApiDocument(input) as any;

    expect(sorted.tags.map((t: any) => t.name)).toEqual(['alpha', 'mu', 'zeta']);
  });

  it('sorts operation parameters by (in, name)', () => {
    const input = {
      paths: {
        '/users/{id}': {
          get: {
            parameters: [
              { in: 'query', name: 'limit' },
              { in: 'path', name: 'id' },
              { in: 'query', name: 'cursor' },
              { in: 'header', name: 'X-Trace' },
            ],
          },
        },
      },
    };

    const sorted = sortOpenApiDocument(input) as any;

    expect(sorted.paths['/users/{id}'].get.parameters).toEqual([
      { in: 'header', name: 'X-Trace' },
      { in: 'path', name: 'id' },
      { in: 'query', name: 'cursor' },
      { in: 'query', name: 'limit' },
    ]);
  });

  it('produces a stable string when re-sorting an already-sorted document', () => {
    const input = {
      paths: {
        '/b': { get: { parameters: [{ in: 'query', name: 'b' }, { in: 'query', name: 'a' }] } },
        '/a': { post: { responses: { '404': {}, '200': {} } } },
      },
      tags: [{ name: 'b' }, { name: 'a' }],
    };

    const onceSorted = JSON.stringify(sortOpenApiDocument(input));
    const twiceSorted = JSON.stringify(sortOpenApiDocument(JSON.parse(onceSorted)));

    expect(twiceSorted).toBe(onceSorted);
  });

  it('does not mutate primitive values, arrays of primitives, or null', () => {
    expect(sortOpenApiDocument(null as any)).toBeNull();
    expect(sortOpenApiDocument(42 as any)).toBe(42);
    expect(sortOpenApiDocument('hello' as any)).toBe('hello');
    expect(sortOpenApiDocument(['c', 'a', 'b'] as any)).toEqual(['c', 'a', 'b']);
  });

  it('handles missing tags and missing paths without throwing', () => {
    expect(() => sortOpenApiDocument({})).not.toThrow();
    expect(() => sortOpenApiDocument({ paths: {} })).not.toThrow();
    expect(() => sortOpenApiDocument({ tags: [] })).not.toThrow();
  });
});
