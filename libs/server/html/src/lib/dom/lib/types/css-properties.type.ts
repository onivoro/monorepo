import { Properties } from 'csstype';

/**
 * CSSProperties maps CSS property names (camelCased or kebab-cased) to values.
 * Uses the csstype definitions for full CSS coverage.
 */
/**
 * CSSProperties maps CSS property names to their values (string or number).
 * Extends the standard csstype Properties with an index signature to allow
 * kebab-case properties, custom properties, and vendor extensions.
 */
export interface CSSProperties extends Properties<string | number> {
  [key: string]: string | number | undefined;
}