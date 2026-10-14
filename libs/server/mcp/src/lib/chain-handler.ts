/**
 * Sets `target[key]` to a function that calls `handler` and then whatever handler was
 * there before, so neither replaces the other. For the SDK's single-slot callbacks
 * (`onclose`, `onerror`, `oninitialized`, ...).
 */
export function chainHandler<
  T extends object,
  K extends {
    [P in keyof T]-?: T[P] extends ((...args: any[]) => any) | undefined
      ? P
      : never;
  }[keyof T],
>(
  target: T,
  key: K,
  handler: (
    ...args: Parameters<NonNullable<T[K]> & ((...args: any[]) => any)>
  ) => void,
): void {
  const previous = target[key] as ((...args: unknown[]) => unknown) | undefined;
  target[key] = ((...args: unknown[]) => {
    (handler as (...args: unknown[]) => void)(...args);
    previous?.(...args);
  }) as T[K];
}
