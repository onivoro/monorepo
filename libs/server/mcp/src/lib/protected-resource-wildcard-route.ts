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
 * The matched wildcard as a path. Nest 10 yields the string, Nest 11 the segments.
 */
export function wildcardParamToPath(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? value.join('/') : (value ?? '');
}
