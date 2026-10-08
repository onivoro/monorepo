import { Test } from '@nestjs/testing';
import { SNSClient } from '@aws-sdk/client-sns';
import { AwsCredentials } from '@onivoro/server-aws-credential-providers';
import { ServerAwsSnsModule } from './server-aws-sns.module';
import { ServerAwsSnsConfig } from './classes/server-aws-sns-config.class';

describe(ServerAwsSnsModule.name, () => {
  const config: ServerAwsSnsConfig = { AWS_REGION: 'us-east-2' };

  it('configure returns a dynamic module that exports its providers', () => {
    const dynamicModule = ServerAwsSnsModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsSnsModule);
    expect(dynamicModule.imports).toHaveLength(1);
    expect(dynamicModule.exports).toEqual([
      ...dynamicModule.imports,
      ...dynamicModule.providers,
    ]);
  });

  it('resolves the config and an SNSClient for the configured region', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsSnsModule.configure(config)],
      providers: [
        {
          provide: 'consumer',
          useFactory: (client: SNSClient, cfg: ServerAwsSnsConfig) => ({
            client,
            cfg,
          }),
          inject: [SNSClient, ServerAwsSnsConfig],
        },
      ],
    }).compile();

    const consumer = moduleRef.get('consumer');
    expect(consumer.cfg).toBe(config);
    expect(consumer.client).toBeInstanceOf(SNSClient);
    await expect(consumer.client.config.region()).resolves.toBe('us-east-2');
    expect(moduleRef.get(AwsCredentials)).toBeUndefined();

    await moduleRef.close();
  });
});
