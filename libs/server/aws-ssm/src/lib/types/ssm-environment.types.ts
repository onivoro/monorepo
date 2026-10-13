import type { SSMClient } from '@aws-sdk/client-ssm';

export type SSMKeyMapper = (member: string, className: string) => string;

export interface SSMEnvironmentOptions {
  envFileKey?: string;
  withDecryption?: boolean;
  exportToProcessEnv?: boolean;
  client?: SSMClient;
}

export interface SSMEnvironmentMetadata {
  ctr: new () => object;
  keyMapper: SSMKeyMapper;
  options: SSMEnvironmentOptions;
}
