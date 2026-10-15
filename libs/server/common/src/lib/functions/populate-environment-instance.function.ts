import {
  getEnvDecoratedMembers,
  getEnvMembers,
  getEnvRequiredMembers,
} from '../decorators/env-member.decorator';
import { constructRaw } from './wrap-environment-class.function';

export interface PopulateEnvironmentInstanceOptions {
  source?: string;
  describe?: (member: string) => string;
  instance?: object;
}

export function populateEnvironmentInstance<T extends object>(
  ctr: new () => T,
  resolve: (member: string) => string | undefined,
  options: PopulateEnvironmentInstanceOptions = {},
): T {
  const { source = 'ENV VAR', describe = (member) => member } = options;
  const instance: any = options.instance ?? constructRaw(ctr);
  const decorated = new Set(getEnvDecoratedMembers(ctr));

  getEnvMembers(ctr, instance).forEach((key) => {
    const resolved = resolve(key);

    if (resolved !== undefined) {
      instance[key] = resolved;
    }

    if (!decorated.has(key) && isEmpty(instance[key])) {
      console.warn(`${ctr.name} MISSING ${source} ${describe(key)}`);
    }
  });

  const missing = getEnvRequiredMembers(ctr).filter((member) =>
    isEmpty(instance[member]),
  );

  if (missing.length) {
    throw new Error(
      `${ctr.name} is missing required values: ${missing.map(describe).join(', ')}`,
    );
  }

  return { ...instance };
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === '';
}
