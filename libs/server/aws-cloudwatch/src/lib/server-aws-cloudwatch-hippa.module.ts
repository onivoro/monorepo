import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server-common';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { awsClientProvider, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';
import { CloudwatchHippaService } from './services/cloudwatch-hippa.service';
import { ServerAwsCloudwatchHippaConfig } from './classes/server-aws-cloudwatch-hippa-config.class';

@Module({
})
export class ServerAwsCloudwatchHippaModule {
  static configure(config: ServerAwsCloudwatchHippaConfig) {
    return moduleFactory({
      module: ServerAwsCloudwatchHippaModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        awsClientProvider(CloudWatchLogsClient, config),
        { provide: ServerAwsCloudwatchHippaConfig, useValue: config },
        CloudwatchHippaService,
      ],
    })
  }
}
