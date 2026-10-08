import {
  combineDisposables,
  toDisposable,
  toDisposableObject,
} from './disposable';

describe('toDisposableObject', () => {
  it('wraps a disposable function in an object whose dispose calls it', () => {
    const fn = jest.fn();
    const obj = toDisposableObject(fn);

    expect(fn).not.toHaveBeenCalled();
    obj.dispose();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('toDisposable', () => {
  it('returns a function that disposes the object', () => {
    const obj = { dispose: jest.fn() };
    const fn = toDisposable(obj);

    expect(obj.dispose).not.toHaveBeenCalled();
    fn();
    expect(obj.dispose).toHaveBeenCalledTimes(1);
  });

  it('calls dispose with the object as this', () => {
    let self: unknown;
    const obj = {
      dispose() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        self = this;
      },
    };

    toDisposable(obj)();
    expect(self).toBe(obj);
  });
});

describe('combineDisposables', () => {
  it('disposes every disposable in reverse order', () => {
    const order: number[] = [];
    const combined = combineDisposables(
      () => order.push(1),
      () => order.push(2),
      () => order.push(3),
    );

    expect(order).toEqual([]);
    combined();
    expect(order).toEqual([3, 2, 1]);
  });

  it('is a no-op with no disposables', () => {
    expect(() => combineDisposables()()).not.toThrow();
  });
});
