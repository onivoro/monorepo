import { Test } from '@nestjs/testing';
import { FirehoseClient } from '@aws-sdk/client-firehose';
import { ServerAwsFirehoseModule } from './server-aws-firehose.module';
import { ServerAwsFirehoseConfig } from './server-aws-firehose-config.class';
import { FirehoseService } from './services/firehose.service';

describe(ServerAwsFirehoseModule.name, () => {
  const config: ServerAwsFirehoseConfig = {
    AWS_FIREHOSE_NAME: 'delivery-stream',
    AWS_REGION: 'ap-southeast-2',
  };

  it('configure returns a dynamic module that exports its providers', () => {
    const dynamicModule = ServerAwsFirehoseModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsFirehoseModule);
    expect(dynamicModule.exports).toEqual([
      ...dynamicModule.imports,
      ...dynamicModule.providers,
    ]);
  });

  it('resolves FirehoseService, the exported FirehoseClient and config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsFirehoseModule.configure(config)],
      providers: [
        {
          provide: 'consumer',
          useFactory: (
            service: FirehoseService,
            client: FirehoseClient,
            cfg: ServerAwsFirehoseConfig,
          ) => ({ service, client, cfg }),
          inject: [FirehoseService, FirehoseClient, ServerAwsFirehoseConfig],
        },
      ],
    }).compile();

    const { service, client, cfg } = moduleRef.get('consumer');
    expect(cfg).toBe(config);
    expect(service).toBeInstanceOf(FirehoseService);
    expect(client).toBeInstanceOf(FirehoseClient);
    await expect(client.config.region()).resolves.toBe('ap-southeast-2');

    await moduleRef.close();
  });
});
