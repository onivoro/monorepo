import { Logger } from '@nestjs/common';

/** The Nest major assumed when the installed version can't be read: the newest supported. */
const FALLBACK_NEST_MAJOR = 11;

/**
 * The wildcard route for path-suffixed protected resource metadata
 * (`/.well-known/oauth-protected-resource/<resource path>`, RFC 9728 §3.1).
 *
 * Nest 11 moved to path-to-regexp v8, which rejects the `:param(*)` form Nest 10
 * requires and requires the `*param` form Nest 10 misreads. No single string
 * works on both, so the syntax follows the Nest that is actually installed.
 */
export function protectedResourceWildcardRoute(nestVersion: string): string {
  const major = Number.parseInt(nestVersion, 10);
  return major >= 11 ? '*resourcePath' : ':resourcePath(*)';
}

/**
 * The matched wildcard as a path without trailing slashes. Nest 10 yields the
 * string, Nest 11 the segments; `api/mcp`, `api/mcp/` and `['api', 'mcp', '']`
 * all become `api/mcp`. Leading and doubled slashes are kept, so they still
 * fail to match.
 */
export function wildcardParamToPath(
  value: string | string[] | undefined,
): string {
  const path = Array.isArray(value) ? value.join('/') : (value ?? '');
  return path.replace(/\/+$/, '');
}

/**
 * The major version of the installed `@nestjs/core`. Each lookup is tried in
 * order: first the copy the app resolves from its working directory, then the
 * copy this package resolves. Falls back to {@link FALLBACK_NEST_MAJOR}, with a
 * warning, when none yields a version.
 *
 * Exported for tests; not part of the package API.
 */
export function detectNestMajor(
  lookups: Array<() => string | undefined> = [
    () =>
      require(
        require.resolve('@nestjs/core/package.json', {
          paths: [process.cwd()],
        }),
      ).version,
    () => require('@nestjs/core/package.json').version,
  ],
): number {
  for (const lookup of lookups) {
    try {
      const major = Number.parseInt(lookup() ?? '', 10);
      if (Number.isInteger(major)) {
        return major;
      }
    } catch {
      // Not resolvable from here; try the next lookup.
    }
  }

  new Logger('ProtectedResourceWildcardRoute').warn(
    `Could not read the installed @nestjs/core version; assuming Nest ${FALLBACK_NEST_MAJOR} route syntax.`,
  );
  return FALLBACK_NEST_MAJOR;
}

/**
 * {@link protectedResourceWildcardRoute} for the installed Nest, read once at
 * load so it is ready before any controller declares its routes.
 */
export const PROTECTED_RESOURCE_WILDCARD = protectedResourceWildcardRoute(
  String(detectNestMajor()),
);
