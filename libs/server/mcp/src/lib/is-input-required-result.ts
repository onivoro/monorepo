/**
 * Whether a handler result asks the client for input (an `inputRequired(...)` result),
 * which must reach the SDK unchanged rather than be wrapped as content.
 */
export function isInputRequiredResult(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { resultType?: unknown }).resultType === 'input_required'
  );
}
