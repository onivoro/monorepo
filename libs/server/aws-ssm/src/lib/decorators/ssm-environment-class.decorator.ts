import 'reflect-metadata';
import {
  loadDotEnvForKey,
  populateEnvironmentInstance,
  wrapEnvironmentClass,
} from '@onivoro/server-common';
import {
  SSMEnvironmentMetadata,
  SSMEnvironmentOptions,
  SSMKeyMapper,
} from '../types/ssm-environment.types';

export const SSM_ENVIRONMENT_METADATA = Symbol.for(
  '@onivoro/server-aws-ssm:environment',
);

export function SSMEnvironmentClass(
  keyMapper: SSMKeyMapper,
  options: SSMEnvironmentOptions = {},
) {
  return function (ctr: any) {
    let warned = false;

    const decorated = wrapEnvironmentClass(ctr, () => {
      loadDotEnvForKey(options.envFileKey);

      if (!warned) {
        warned = true;
        console.warn(
          `${ctr.name} was constructed without SSM values; use loadSSMEnvironment(${ctr.name})`,
        );
      }

      return populateEnvironmentInstance(ctr, (key) => process.env[key]);
    }) as typeof ctr;

    const metadata: SSMEnvironmentMetadata = { ctr, keyMapper, options };
    Reflect.defineMetadata(SSM_ENVIRONMENT_METADATA, metadata, decorated);

    return decorated;
  };
}
