import { Test } from '@nestjs/testing';
import { S3Client } from '@aws-sdk/client-s3';
import { ServerAwsS3Module } from './server-aws-s3.module';
import { ServerAwsS3Config } from './server-aws-s3-config.class';
import { S3Service } from './services/s3.service';

describe(ServerAwsS3Module.name, () => {
  const config: ServerAwsS3Config = {
    AWS_BUCKET: 'my-bucket',
    AWS_REGION: 'us-east-2',
  };

  it('configure returns a dynamic module for ServerAwsS3Module', () => {
    const dynamicModule = ServerAwsS3Module.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsS3Module);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        S3Service,
        { provide: ServerAwsS3Config, useValue: config },
      ]),
    );
  });

  it('wires S3Service to an S3Client in the configured region', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsS3Module.configure(config)],
    }).compile();

    const client = moduleRef.get(S3Client);
    expect(client).toBeInstanceOf(S3Client);
    await expect(client.config.region()).resolves.toBe('us-east-2');
    expect(moduleRef.get(S3Service)).toBeInstanceOf(S3Service);
    expect(moduleRef.get(ServerAwsS3Config)).toBe(config);
  });
});
