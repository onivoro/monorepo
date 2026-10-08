import { Test } from '@nestjs/testing';
import { STSClient } from '@aws-sdk/client-sts';
import { ServerAwsStsModule } from './server-aws-sts.module';
import { ServerAwsStsConfig } from './classes/server-aws-sts-config.class';
import { StsService } from './services/sts.service';

describe(ServerAwsStsModule.name, () => {
  const config: ServerAwsStsConfig = { AWS_REGION: 'us-west-1' };

  it('configure returns a dynamic module that exports its providers', () => {
    const dynamicModule = ServerAwsStsModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsStsModule);
    expect(dynamicModule.exports).toEqual([
      ...dynamicModule.imports,
      ...dynamicModule.providers,
    ]);
  });

  it('resolves StsService wired to the exported STSClient and config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsStsModule.configure(config)],
      providers: [
        {
          provide: 'consumer',
          useFactory: (
            service: StsService,
            client: STSClient,
            cfg: ServerAwsStsConfig,
          ) => ({ service, client, cfg }),
          inject: [StsService, STSClient, ServerAwsStsConfig],
        },
      ],
    }).compile();

    const { service, client, cfg } = moduleRef.get('consumer');
    expect(cfg).toBe(config);
    expect(client).toBeInstanceOf(STSClient);
    expect(service).toBeInstanceOf(StsService);
    expect(service.stsClient).toBe(client);
    await expect(client.config.region()).resolves.toBe('us-west-1');

    await moduleRef.close();
  });
});
