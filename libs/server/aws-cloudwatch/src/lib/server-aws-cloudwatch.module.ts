import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { CloudwatchService } from './services/cloudwatch.service';
import { ServerAwsCloudwatchConfig } from './classes/server-aws-cloudwatch-config.class';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';
import { CloudwatchLogsService } from './services/cloudwatch-logs.service';

let cloudwatchClient: CloudWatchClient | null = null;
let cloudwatchLogsClient: CloudWatchLogsClient | null = null;

@Module({
})
export class ServerAwsCloudwatchModule {
  static configure(config: ServerAwsCloudwatchConfig) {
    return moduleFactory({
      module: ServerAwsCloudwatchModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        {
          provide: CloudWatchClient,
          useFactory: (credentials: AwsCredentials) => cloudwatchClient
            ? cloudwatchClient
            : cloudwatchClient = new CloudWatchClient({
              region: config.AWS_REGION,
              logger: console,
              credentials
            }),
          inject: [AwsCredentials]
        },
        {
          provide: CloudWatchLogsClient,
          useFactory: (credentials: AwsCredentials) => cloudwatchLogsClient
            ? cloudwatchLogsClient
            : cloudwatchLogsClient = new CloudWatchLogsClient({
              region: config.AWS_REGION,
              logger: console,
              credentials
            }),
          inject: [AwsCredentials]
        },
        { provide: ServerAwsCloudwatchConfig, useValue: config },
        CloudwatchService,
        CloudwatchLogsService,
      ],
    })
  }
}