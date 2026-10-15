import {
  constructRaw,
  isEnvironmentClass,
  wrapEnvironmentClass,
} from './wrap-environment-class.function';

describe('wrapEnvironmentClass', () => {
  class Raw {
    HOST = 'localhost';
  }

  it('returns construct() when constructed directly and marks the class', () => {
    const Wrapped = wrapEnvironmentClass(Raw, () => ({ HOST: 'populated' }));

    expect(new Wrapped()).toEqual({ HOST: 'populated' });
    expect(isEnvironmentClass(Wrapped)).toBe(true);
    expect(isEnvironmentClass(Raw)).toBe(false);
  });

  it('builds a plain instance under constructRaw, including nested wrappers', () => {
    const construct = jest.fn(() => ({}));
    const Wrapped = wrapEnvironmentClass(Raw, construct);

    const instance = constructRaw(Wrapped);

    expect(instance).toBeInstanceOf(Raw);
    expect(instance.HOST).toBe('localhost');
    expect(construct).not.toHaveBeenCalled();
    expect(new Wrapped()).toEqual({});
    expect(construct).toHaveBeenCalledTimes(1);
  });

  it('builds a plain parent instance when a wrapped subclass is constructed', () => {
    const parentConstruct = jest.fn(() => ({ FROM: 'parent' }));
    const Parent = wrapEnvironmentClass(Raw, parentConstruct);

    class ChildRaw extends Parent {
      PORT = '3000';
    }

    const Child = wrapEnvironmentClass(ChildRaw, () => ({ FROM: 'child' }));

    expect(new Child()).toEqual({ FROM: 'child' });
    expect(parentConstruct).not.toHaveBeenCalled();
  });

  it('lets an unwrapped subclass be populated by the wrapped parent', () => {
    const Parent = wrapEnvironmentClass(Raw, () => ({ FROM: 'parent' }));

    class Sub extends Parent {}

    expect(new Sub()).toEqual({ FROM: 'parent' });
  });

  it('resets after constructRaw throws', () => {
    class Throws {
      constructor() {
        throw new Error('boom');
      }
    }

    expect(() => constructRaw(Throws)).toThrow('boom');
    expect(
      new (wrapEnvironmentClass(Raw, () => ({ FROM: 'construct' })))(),
    ).toEqual({ FROM: 'construct' });
  });
});
