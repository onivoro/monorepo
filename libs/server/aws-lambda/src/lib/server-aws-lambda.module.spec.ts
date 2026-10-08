import { Test } from '@nestjs/testing';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { AwsCredentials } from '@onivoro/server-aws-credential-providers';
import { ServerAwsLambdaModule } from './server-aws-lambda.module';
import { ServerAwsLambdaConfig } from './classes/server-aws-lambda-config.class';
import { LambdaService } from './services/lambda.service';

describe(ServerAwsLambdaModule.name, () => {
  it('configure returns a dynamic module for ServerAwsLambdaModule', () => {
    const config = new ServerAwsLambdaConfig('us-east-2');

    const dynamicModule = ServerAwsLambdaModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsLambdaModule);
    expect(dynamicModule.providers).toContain(LambdaService);
    expect(dynamicModule.providers).toContainEqual({
      provide: ServerAwsLambdaConfig,
      useValue: config,
    });
  });

  it('wires LambdaService to a LambdaClient in the configured region', async () => {
    const config = new ServerAwsLambdaConfig('us-west-2');

    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsLambdaModule.configure(config)],
    }).compile();

    const client = moduleRef.get(LambdaClient);
    expect(client).toBeInstanceOf(LambdaClient);
    await expect(client.config.region()).resolves.toBe('us-west-2');
    expect(moduleRef.get(LambdaService)).toBeInstanceOf(LambdaService);
    expect(moduleRef.get(ServerAwsLambdaConfig)).toBe(config);
    expect(moduleRef.get(AwsCredentials)).toBeUndefined();
  });
});
