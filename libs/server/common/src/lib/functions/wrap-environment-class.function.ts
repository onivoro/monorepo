import 'reflect-metadata';

const ENVIRONMENT_CLASS_METADATA = Symbol.for(
  '@onivoro/server-common:environment-class',
);
const RAW_CONSTRUCTION_DEPTH = Symbol.for(
  '@onivoro/server-common:raw-construction-depth',
);

const state = globalThis as typeof globalThis & {
  [RAW_CONSTRUCTION_DEPTH]?: number;
};

export function wrapEnvironmentClass<C extends new () => object>(
  ctr: C,
  construct: () => object,
): C {
  const Wrapped = class extends (ctr as new () => object) {
    constructor() {
      super();

      if (
        isConstructingRaw() ||
        (new.target !== Wrapped && isEnvironmentClass(new.target))
      ) {
        return;
      }

      return construct();
    }
  };

  Reflect.defineMetadata(ENVIRONMENT_CLASS_METADATA, true, Wrapped);

  return Wrapped as unknown as C;
}

export function isEnvironmentClass(ctr: Function): boolean {
  return Reflect.getOwnMetadata(ENVIRONMENT_CLASS_METADATA, ctr) === true;
}

export function constructRaw<T>(ctr: new () => T): T {
  state[RAW_CONSTRUCTION_DEPTH] = (state[RAW_CONSTRUCTION_DEPTH] ?? 0) + 1;

  try {
    return new ctr();
  } finally {
    state[RAW_CONSTRUCTION_DEPTH]!--;
  }
}

function isConstructingRaw(): boolean {
  return (state[RAW_CONSTRUCTION_DEPTH] ?? 0) > 0;
}
