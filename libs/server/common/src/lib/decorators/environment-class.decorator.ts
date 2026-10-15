import 'reflect-metadata';
import { loadDotEnvForKey } from '../functions/load-dot-env-for-key.function';
import { populateEnvironmentInstance } from '../functions/populate-environment-instance.function';
import { wrapEnvironmentClass } from '../functions/wrap-environment-class.function';

export function EnvironmentClass(envFileKey?: string) {
  return function (ctr: any) {
    return wrapEnvironmentClass(ctr, () => {
      loadDotEnvForKey(envFileKey);
      return populateEnvironmentInstance(ctr, (key) => process.env[key]);
    }) as typeof ctr;
  };
}
