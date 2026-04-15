import { AwsCredentials } from './aws-credentials.class';

export function awsClientProvider<T>(
  ClientClass: new (config: any) => T,
  config: { AWS_REGION: string },
  extras?: Record<string, any>
) {
  return {
    provide: ClientClass,
    useFactory: (credentials: AwsCredentials) =>
      new ClientClass({
        region: config.AWS_REGION,
        credentials: credentials || undefined,
        ...extras,
      }),
    inject: [AwsCredentials],
  };
}
