import 'reflect-metadata';
import {
  GetParametersCommand,
  Parameter,
  SSMClient,
} from '@aws-sdk/client-ssm';
import { resolveAwsCredentialProvidersByProfile } from '@onivoro/server-aws-credential-providers';
import {
  constructRaw,
  getEnvMembers,
  loadDotEnvForKey,
  populateEnvironmentInstance,
} from '@onivoro/server-common';
import { SSM_ENVIRONMENT_METADATA } from '../decorators/ssm-environment-class.decorator';
import {
  SSMEnvironmentMetadata,
  SSMEnvironmentOptions,
} from '../types/ssm-environment.types';

const GET_PARAMETERS_LIMIT = 10;

export async function loadSSMEnvironment<T extends object>(
  Cls: new () => T,
  overrides: SSMEnvironmentOptions = {},
): Promise<T> {
  const metadata: SSMEnvironmentMetadata | undefined = Reflect.getOwnMetadata(
    SSM_ENVIRONMENT_METADATA,
    Cls,
  );

  if (!metadata) {
    throw new Error(`${Cls.name} is not decorated with @SSMEnvironmentClass`);
  }

  const { ctr, keyMapper } = metadata;
  const options = { ...metadata.options, ...overrides };

  loadDotEnvForKey(options.envFileKey);

  const instance = constructRaw(ctr);
  const keyByMember = new Map<string, string>();

  getEnvMembers(ctr, instance).forEach((member) => {
    const key = keyMapper(member, ctr.name);

    if (typeof key !== 'string' || !key.trim()) {
      throw new Error(
        `${ctr.name} SSM key mapper returned an empty or non-string key for ${member}`,
      );
    }

    keyByMember.set(member, key);
  });

  const keysToFetch = [
    ...new Set(
      [...keyByMember]
        .filter(([member]) => process.env[member] === undefined)
        .map(([, key]) => key),
    ),
  ];

  const valueByKey = keysToFetch.length
    ? await fetchParameters(
        ctr.name,
        options.client ?? (await createClient()),
        keysToFetch,
        options.withDecryption ?? true,
      )
    : new Map<string, string>();

  const resolve = (member: string) =>
    process.env[member] !== undefined
      ? process.env[member]
      : valueByKey.get(keyByMember.get(member)!);

  const populated = populateEnvironmentInstance(ctr, resolve, {
    instance,
    source: 'ENV VAR OR SSM PARAMETER',
    describe: (member) => `${member} (SSM key ${keyByMember.get(member)})`,
  }) as T;

  if (options.exportToProcessEnv) {
    keyByMember.forEach((key, member) => {
      if (process.env[member] === undefined && valueByKey.has(key)) {
        process.env[member] = valueByKey.get(key);
      }
    });
  }

  return populated;
}

async function createClient() {
  return new SSMClient({
    region: process.env['AWS_REGION'],
    credentials: await resolveAwsCredentialProvidersByProfile(
      process.env['AWS_PROFILE'],
    ),
  });
}

async function fetchParameters(
  className: string,
  client: SSMClient,
  keys: string[],
  withDecryption: boolean,
) {
  const chunks: string[][] = [];

  for (let i = 0; i < keys.length; i += GET_PARAMETERS_LIMIT) {
    chunks.push(keys.slice(i, i + GET_PARAMETERS_LIMIT));
  }

  const responses = await Promise.all(
    chunks.map((Names) =>
      client.send(
        new GetParametersCommand({ Names, WithDecryption: withDecryption }),
      ),
    ),
  );

  const notFound = responses.flatMap(
    (response) => response.InvalidParameters ?? [],
  );

  if (notFound.length) {
    console.warn(
      `${className} SSM PARAMETERS NOT FOUND ${notFound.join(', ')}`,
    );
  }

  const parameterByIdentifier = new Map<string, Parameter>();

  responses
    .flatMap((response) => response.Parameters ?? [])
    .forEach((parameter) => {
      (parameter.Selector
        ? [
            `${parameter.Name}${parameter.Selector}`,
            `${parameter.ARN}${parameter.Selector}`,
          ]
        : [parameter.Name, parameter.ARN]
      )
        .filter((identifier): identifier is string => !!identifier)
        .forEach((identifier) =>
          parameterByIdentifier.set(identifier, parameter),
        );
    });

  const valueByKey = new Map<string, string>();

  keys.forEach((key) => {
    const value = parameterByIdentifier.get(key)?.Value;

    if (value !== undefined) {
      valueByKey.set(key, value);
    }
  });

  return valueByKey;
}
