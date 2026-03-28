/**
 * Pending request entry with promise resolution functions.
 */
interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (reason?: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}

/**
 * A utility class for correlating async request-response pairs.
 *
 * This class manages pending requests with:
 * - Unique ID generation and tracking
 * - Promise-based resolution
 * - Automatic timeout handling
 * - Cleanup of resolved/rejected requests
 *
 * @example
 * ```typescript
 * const correlator = new RequestCorrelator<MyResponse>(30000);
 *
 * // Create a request
 * const { id, promise } = correlator.createRequest();
 *
 * // Send request with id
 * sendMessage({ id, method: 'foo', params: {} });
 *
 * // When response arrives
 * correlator.resolve(responseId, result);
 *
 * // Or in calling code
 * const result = await promise;
 * ```
 */
export class RequestCorrelator<T = unknown> {
  private pendingRequests: Map<string, PendingRequest<T>> = new Map();
  private requestCounter = 0;

  /**
   * @param defaultTimeoutMs - Default timeout in milliseconds (default: 30000)
   */
  constructor(private readonly defaultTimeoutMs: number = 30000) {}

  /**
   * Create a new pending request.
   *
   * @param timeoutMs - Optional custom timeout for this request
   * @returns Object with the request id and a promise that resolves with the response
   */
  createRequest(timeoutMs?: number): { id: string; promise: Promise<T> } {
    const id = (++this.requestCounter).toString();
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    const promise = new Promise<T>((resolve, reject) => {
      const entry: PendingRequest<T> = { resolve, reject };

      if (timeout > 0) {
        entry.timeoutId = setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${id} timed out after ${timeout}ms`));
        }, timeout);
      }

      this.pendingRequests.set(id, entry);
    });

    return { id, promise };
  }

  /**
   * Resolve a pending request with a result.
   *
   * @param id - The request id to resolve
   * @param result - The result value
   * @returns true if the request was found and resolved, false otherwise
   */
  resolve(id: string, result: T): boolean {
    const pending = this.pendingRequests.get(id);
    if (!pending) {
      return false;
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    this.pendingRequests.delete(id);
    pending.resolve(result);
    return true;
  }

  /**
   * Reject a pending request with an error.
   *
   * @param id - The request id to reject
   * @param error - The error to reject with
   * @returns true if the request was found and rejected, false otherwise
   */
  reject(id: string, error: Error): boolean {
    const pending = this.pendingRequests.get(id);
    if (!pending) {
      return false;
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    this.pendingRequests.delete(id);
    pending.reject(error);
    return true;
  }

  /**
   * Check if a request is pending.
   */
  hasPending(id: string): boolean {
    return this.pendingRequests.has(id);
  }

  /**
   * Get the number of pending requests.
   */
  get pendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Cancel all pending requests with an error.
   */
  cancelAll(error?: Error): void {
    const cancelError = error ?? new Error('All requests cancelled');
    for (const [id, pending] of this.pendingRequests) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.reject(cancelError);
    }
    this.pendingRequests.clear();
  }
}
