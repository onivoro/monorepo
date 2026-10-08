import { Test } from '@nestjs/testing';
import { IAMClient } from '@aws-sdk/client-iam';
import { ServerAwsIamModule } from './server-aws-iam.module';
import { ServerAwsIamConfig } from './classes/server-aws-iam-config.class';
import { IamService } from './services/iam.service';

describe(ServerAwsIamModule.name, () => {
  const config: ServerAwsIamConfig = { AWS_REGION: 'us-east-1' };

  it('configure returns a dynamic module that exports its providers', () => {
    const dynamicModule = ServerAwsIamModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsIamModule);
    expect(dynamicModule.exports).toEqual([
      ...dynamicModule.imports,
      ...dynamicModule.providers,
    ]);
  });

  it('resolves IamService wired to the exported IAMClient and config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsIamModule.configure(config)],
      providers: [
        {
          provide: 'consumer',
          useFactory: (
            service: IamService,
            client: IAMClient,
            cfg: ServerAwsIamConfig,
          ) => ({ service, client, cfg }),
          inject: [IamService, IAMClient, ServerAwsIamConfig],
        },
      ],
    }).compile();

    const { service, client, cfg } = moduleRef.get('consumer');
    expect(cfg).toBe(config);
    expect(client).toBeInstanceOf(IAMClient);
    expect(service).toBeInstanceOf(IamService);
    expect(service.iamClient).toBe(client);

    await moduleRef.close();
  });
});
