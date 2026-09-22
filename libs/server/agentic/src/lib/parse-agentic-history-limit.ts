export const AGENTIC_HISTORY_LIMIT_MAX = 100;

/**
 * Parses the `limit` query parameter shared by the agentic conversation and
 * message history routes. A missing, non-numeric, or non-positive value falls
 * back to the caller's own default, and anything larger than
 * `AGENTIC_HISTORY_LIMIT_MAX` is clamped so a hand-edited URL cannot ask for an
 * unbounded page of history.
 */
export function parseAgenticHistoryLimit(
  limit: string | undefined,
): number | undefined {
  if (!limit) return undefined;

  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;

  return Math.min(Math.trunc(parsed), AGENTIC_HISTORY_LIMIT_MAX);
}
