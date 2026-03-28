/**
 * A function that cleans up a subscription or resource.
 */
export type Disposable = () => void;

/**
 * An object that can be disposed to release resources.
 */
export interface DisposableObject {
  dispose(): void;
}

/**
 * Converts a Disposable function to a DisposableObject.
 */
export function toDisposableObject(disposable: Disposable): DisposableObject {
  return { dispose: disposable };
}

/**
 * Converts a DisposableObject to a Disposable function.
 */
export function toDisposable(obj: DisposableObject): Disposable {
  return () => obj.dispose();
}

/**
 * Combines multiple disposables into a single disposable.
 * When called, disposes all in reverse order (LIFO).
 */
export function combineDisposables(...disposables: Disposable[]): Disposable {
  return () => {
    for (let i = disposables.length - 1; i >= 0; i--) {
      disposables[i]();
    }
  };
}
