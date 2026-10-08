import { Test } from '@nestjs/testing';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { ServerAwsCloudwatchModule } from './server-aws-cloudwatch.module';
import { ServerAwsCloudwatchConfig } from './classes/server-aws-cloudwatch-config.class';
import { CloudwatchService } from './services/cloudwatch.service';
import { CloudwatchLogsService } from './services/cloudwatch-logs.service';

describe(ServerAwsCloudwatchModule.name, () => {
  const config: ServerAwsCloudwatchConfig = { AWS_REGION: 'eu-central-1' };

  it('configure returns a dynamic module for ServerAwsCloudwatchModule', () => {
    const dynamicModule = ServerAwsCloudwatchModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsCloudwatchModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        CloudwatchService,
        CloudwatchLogsService,
        { provide: ServerAwsCloudwatchConfig, useValue: config },
      ]),
    );
  });

  it('wires both services to clients in the configured region', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsCloudwatchModule.configure(config)],
    }).compile();

    const cloudwatch = moduleRef.get(CloudWatchClient);
    const logs = moduleRef.get(CloudWatchLogsClient);
    expect(cloudwatch).toBeInstanceOf(CloudWatchClient);
    expect(logs).toBeInstanceOf(CloudWatchLogsClient);
    await expect(cloudwatch.config.region()).resolves.toBe('eu-central-1');
    await expect(logs.config.region()).resolves.toBe('eu-central-1');
    expect(moduleRef.get(CloudwatchService).cloudwatchClient).toBe(cloudwatch);
    expect(moduleRef.get(CloudwatchLogsService)).toBeInstanceOf(
      CloudwatchLogsService,
    );
    expect(moduleRef.get(ServerAwsCloudwatchConfig)).toBe(config);
  });
});
