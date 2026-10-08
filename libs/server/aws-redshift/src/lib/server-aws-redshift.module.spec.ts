import { Test } from '@nestjs/testing';
import { RedshiftDataClient } from '@aws-sdk/client-redshift-data';
import { RedshiftServerlessClient } from '@aws-sdk/client-redshift-serverless';
import { RedshiftClient } from '@aws-sdk/client-redshift';
import { ServerAwsRedshiftDataModule } from './server-aws-redshift.module';
import { ServerAwsRedshiftDataConfig } from './classes/server-aws-redshift-config.class';
import { RedshiftDataService } from './services/redshift.service';

describe(ServerAwsRedshiftDataModule.name, () => {
  const config: ServerAwsRedshiftDataConfig = { AWS_REGION: 'us-east-2' };

  it('configure returns a dynamic module for ServerAwsRedshiftDataModule', () => {
    const dynamicModule = ServerAwsRedshiftDataModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsRedshiftDataModule);
    expect(dynamicModule.providers).toContain(RedshiftDataService);
    expect(dynamicModule.providers).toContainEqual({
      provide: ServerAwsRedshiftDataConfig,
      useValue: config,
    });
  });

  it('wires the service and all three clients in the configured region', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsRedshiftDataModule.configure(config)],
    }).compile();

    for (const Client of [
      RedshiftDataClient,
      RedshiftServerlessClient,
      RedshiftClient,
    ] as const) {
      const client = moduleRef.get<any>(Client);
      expect(client).toBeInstanceOf(Client);
      await expect(client.config.region()).resolves.toBe('us-east-2');
    }
    expect(moduleRef.get(RedshiftDataService)).toBeInstanceOf(
      RedshiftDataService,
    );
    expect(moduleRef.get(ServerAwsRedshiftDataConfig)).toBe(config);
  });
  it('reuses the same clients when the module is compiled again', async () => {
    const compile = () =>
      Test.createTestingModule({
        imports: [ServerAwsRedshiftDataModule.configure(config)],
      }).compile();
    const [first, second] = [await compile(), await compile()];

    for (const Client of [
      RedshiftDataClient,
      RedshiftServerlessClient,
      RedshiftClient,
    ] as const) {
      expect(second.get<any>(Client)).toBe(first.get<any>(Client));
    }
  });
});
