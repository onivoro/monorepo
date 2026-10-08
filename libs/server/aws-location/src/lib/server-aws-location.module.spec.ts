import { Test } from '@nestjs/testing';
import { LocationClient } from '@aws-sdk/client-location';
import { ServerAwsLocationModule } from './server-aws-location.module';
import { ServerAwsLocationConfig } from './server-aws-location-config.class';
import { LocationService } from './services/location.service';

describe(ServerAwsLocationModule.name, () => {
  const config: ServerAwsLocationConfig = {
    AWS_REGION: 'us-west-2',
    ROUTE_CALCULATOR_NAME: 'my-calculator',
    PLACE_INDEX_NAME: 'my-index',
  };

  it('configure returns a dynamic module that exports its providers', () => {
    const dynamicModule = ServerAwsLocationModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsLocationModule);
    expect(dynamicModule.exports).toEqual([
      ...dynamicModule.imports,
      ...dynamicModule.providers,
    ]);
  });

  it('resolves LocationService, the exported LocationClient and config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsLocationModule.configure(config)],
      providers: [
        {
          provide: 'consumer',
          useFactory: (
            service: LocationService,
            client: LocationClient,
            cfg: ServerAwsLocationConfig,
          ) => ({ service, client, cfg }),
          inject: [LocationService, LocationClient, ServerAwsLocationConfig],
        },
      ],
    }).compile();

    const { service, client, cfg } = moduleRef.get('consumer');
    expect(cfg).toBe(config);
    expect(service).toBeInstanceOf(LocationService);
    expect(client).toBeInstanceOf(LocationClient);
    await expect(client.config.region()).resolves.toBe('us-west-2');

    await moduleRef.close();
  });
});
