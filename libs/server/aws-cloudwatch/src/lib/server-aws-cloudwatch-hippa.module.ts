import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';
import { CloudwatchHippaService } from './services/cloudwatch-hippa.service';
import { ServerAwsCloudwatchHippaConfig } from './classes/server-aws-cloudwatch-hippa-config.class';

let cloudwatchLogsClient: CloudWatchLogsClient | null = null;

@Module({
})
export class ServerAwsCloudwatchHippaModule {
  static configure(config: ServerAwsCloudwatchHippaConfig) {
    return moduleFactory({
      module: ServerAwsCloudwatchHippaModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
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
        { provide: ServerAwsCloudwatchHippaConfig, useValue: config },
        CloudwatchHippaService,
      ],
    })
  }
}