import { Test } from '@nestjs/testing';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { ServerAwsCloudwatchHippaModule } from './server-aws-cloudwatch-hippa.module';
import { ServerAwsCloudwatchHippaConfig } from './classes/server-aws-cloudwatch-hippa-config.class';
import { CloudwatchHippaService } from './services/cloudwatch-hippa.service';

describe(ServerAwsCloudwatchHippaModule.name, () => {
  const config: ServerAwsCloudwatchHippaConfig = {
    AWS_REGION: 'us-west-1',
    LOG_GROUP: 'hipaa-audit-logs',
  };

  it('configure returns a dynamic module for ServerAwsCloudwatchHippaModule', () => {
    const dynamicModule = ServerAwsCloudwatchHippaModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsCloudwatchHippaModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        CloudwatchHippaService,
        { provide: ServerAwsCloudwatchHippaConfig, useValue: config },
      ]),
    );
  });

  it('wires CloudwatchHippaService to a CloudWatchLogsClient in the configured region', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsCloudwatchHippaModule.configure(config)],
    }).compile();

    const client = moduleRef.get(CloudWatchLogsClient);
    expect(client).toBeInstanceOf(CloudWatchLogsClient);
    await expect(client.config.region()).resolves.toBe('us-west-1');
    expect(moduleRef.get(CloudwatchHippaService)).toBeInstanceOf(
      CloudwatchHippaService,
    );
    expect(moduleRef.get(ServerAwsCloudwatchHippaConfig)).toBe(config);
  });
});
