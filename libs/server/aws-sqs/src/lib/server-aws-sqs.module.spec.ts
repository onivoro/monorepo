import { Test } from '@nestjs/testing';
import { SQSClient } from '@aws-sdk/client-sqs';
import { ServerAwsSqsModule } from './server-aws-sqs.module';
import { ServerAwsSqsConfig } from './classes/server-aws-sqs-config.class';
import { SqsService } from './services/sqs.service';
import { SqsConsumerFactoryService } from './services/sqs-consumer-factory.service';

describe(ServerAwsSqsModule.name, () => {
  const config: ServerAwsSqsConfig = {
    AWS_REGION: 'ap-southeast-2',
    AWS_SQS_URL: 'https://sqs.example/123/queue',
  };

  it('configure returns a dynamic module for ServerAwsSqsModule', () => {
    const dynamicModule = ServerAwsSqsModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsSqsModule);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        SqsService,
        SqsConsumerFactoryService,
        { provide: ServerAwsSqsConfig, useValue: config },
      ]),
    );
  });

  it('wires the services to an SQSClient in the configured region', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsSqsModule.configure(config)],
    }).compile();

    const client = moduleRef.get(SQSClient);
    expect(client).toBeInstanceOf(SQSClient);
    await expect(client.config.region()).resolves.toBe('ap-southeast-2');
    expect(moduleRef.get(SqsService)).toBeInstanceOf(SqsService);
    expect(moduleRef.get(SqsConsumerFactoryService)).toBeInstanceOf(
      SqsConsumerFactoryService,
    );
    expect(moduleRef.get(ServerAwsSqsConfig)).toBe(config);
  });
});
