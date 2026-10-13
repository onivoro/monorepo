import 'reflect-metadata';
import { constructRaw } from '../functions/wrap-environment-class.function';

export const ENV_MEMBER_METADATA = Symbol.for(
  '@onivoro/server-common:env-member',
);

type EnvMemberRegistry = Record<string, { required: boolean }>;

export function EnvRequired(): PropertyDecorator {
  return registerEnvMember(true);
}

export function EnvOptional(): PropertyDecorator {
  return registerEnvMember(false);
}

export function getEnvRequiredMembers(ctr: Function): string[] {
  return Object.entries(getEnvMemberRegistry(ctr))
    .filter(([, { required }]) => required)
    .map(([member]) => member);
}

export function getEnvDecoratedMembers(ctr: Function): string[] {
  return Object.keys(getEnvMemberRegistry(ctr));
}

export function getEnvMembers(
  ctr: new () => object,
  instance: object = constructRaw(ctr),
): string[] {
  return [
    ...new Set([...Object.keys(instance), ...getEnvDecoratedMembers(ctr)]),
  ];
}

function registerEnvMember(required: boolean): PropertyDecorator {
  return (target, propertyKey) => {
    const ctr = target.constructor;
    const own: EnvMemberRegistry =
      Reflect.getOwnMetadata(ENV_MEMBER_METADATA, ctr) ?? {};

    Reflect.defineMetadata(
      ENV_MEMBER_METADATA,
      { ...own, [String(propertyKey)]: { required } },
      ctr,
    );
  };
}

function getEnvMemberRegistry(ctr: Function): EnvMemberRegistry {
  const chain: Function[] = [];

  for (
    let current = ctr;
    current && current !== Function.prototype;
    current = Object.getPrototypeOf(current)
  ) {
    chain.unshift(current);
  }

  return chain.reduce<EnvMemberRegistry>(
    (registry, current) => ({
      ...registry,
      ...(Reflect.getOwnMetadata(ENV_MEMBER_METADATA, current) ?? {}),
    }),
    {},
  );
}
