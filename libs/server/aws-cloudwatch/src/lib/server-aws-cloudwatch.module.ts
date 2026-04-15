import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { CloudwatchService } from './services/cloudwatch.service';
import { ServerAwsCloudwatchConfig } from './classes/server-aws-cloudwatch-config.class';
import { awsClientProvider, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';
import { CloudwatchLogsService } from './services/cloudwatch-logs.service';

@Module({
})
export class ServerAwsCloudwatchModule {
  static configure(config: ServerAwsCloudwatchConfig) {
    return moduleFactory({
      module: ServerAwsCloudwatchModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        awsClientProvider(CloudWatchClient, config),
        awsClientProvider(CloudWatchLogsClient, config),
        { provide: ServerAwsCloudwatchConfig, useValue: config },
        CloudwatchService,
        CloudwatchLogsService,
      ],
    })
  }
}
