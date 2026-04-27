export function sortOpenApiDocument<T>(document: T): T {
  if (document && typeof document === 'object' && !Array.isArray(document)) {
    const root = document as Record<string, unknown>;

    if (Array.isArray(root['tags'])) {
      root['tags'] = [...(root['tags'] as Array<Record<string, unknown>>)].sort((a, b) =>
        String(a?.['name'] ?? '').localeCompare(String(b?.['name'] ?? '')),
      );
    }

    const paths = root['paths'];
    if (paths && typeof paths === 'object') {
      for (const pathItem of Object.values(paths as Record<string, unknown>)) {
        if (!pathItem || typeof pathItem !== 'object') continue;
        for (const operation of Object.values(pathItem as Record<string, unknown>)) {
          if (!operation || typeof operation !== 'object') continue;
          const params = (operation as Record<string, unknown>)['parameters'];
          if (Array.isArray(params)) {
            (operation as Record<string, unknown>)['parameters'] = [...(params as Array<Record<string, unknown>>)].sort((a, b) => {
              const inCmp = String(a?.['in'] ?? '').localeCompare(String(b?.['in'] ?? ''));
              return inCmp !== 0 ? inCmp : String(a?.['name'] ?? '').localeCompare(String(b?.['name'] ?? ''));
            });
          }
        }
      }
    }
  }

  return sortObjectKeysDeep(document);
}

function sortObjectKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sortObjectKeysDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortObjectKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {}) as unknown as T;
  }
  return value;
}
