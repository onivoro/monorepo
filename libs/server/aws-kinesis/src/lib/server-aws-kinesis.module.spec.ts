import { Test } from '@nestjs/testing';
import { KinesisClient } from '@aws-sdk/client-kinesis';
import { ServerAwsKinesisModule } from './server-aws-kinesis.module';
import { ServerAwsKinesisConfig } from './classes/server-aws-kinesis-config.class';
import { KinesisService } from './services/kinesis.service';

describe(ServerAwsKinesisModule.name, () => {
  const config: ServerAwsKinesisConfig = {
    AWS_KINESIS_NAME: 'events-stream',
    AWS_REGION: 'eu-central-1',
  };

  it('configure returns a dynamic module that exports its providers', () => {
    const dynamicModule = ServerAwsKinesisModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsKinesisModule);
    expect(dynamicModule.exports).toEqual([
      ...dynamicModule.imports,
      ...dynamicModule.providers,
    ]);
  });

  it('resolves KinesisService, the exported KinesisClient and config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsKinesisModule.configure(config)],
      providers: [
        {
          provide: 'consumer',
          useFactory: (
            service: KinesisService,
            client: KinesisClient,
            cfg: ServerAwsKinesisConfig,
          ) => ({ service, client, cfg }),
          inject: [KinesisService, KinesisClient, ServerAwsKinesisConfig],
        },
      ],
    }).compile();

    const { service, client, cfg } = moduleRef.get('consumer');
    expect(cfg).toBe(config);
    expect(service).toBeInstanceOf(KinesisService);
    expect(client).toBeInstanceOf(KinesisClient);
    await expect(client.config.region()).resolves.toBe('eu-central-1');

    await moduleRef.close();
  });
});
