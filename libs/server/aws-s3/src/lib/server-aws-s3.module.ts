import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { moduleFactory } from '@onivoro/server-common';
import { ServerAwsS3Config } from './server-aws-s3-config.class';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server-aws-credential-providers';
import { S3Service } from './services/s3.service';

let s3Client: S3Client | null = null;

@Module({})
export class ServerAwsS3Module {
  static configure(config: ServerAwsS3Config) {
    return moduleFactory({
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      module: ServerAwsS3Module,
      providers: [
        { provide: ServerAwsS3Config, useValue: config },
        S3Service,
        {
          provide: S3Client,
          useFactory: (credentials: AwsCredentials) =>
            s3Client ||
            (s3Client = new S3Client({
              region: config.AWS_REGION,
              credentials
            })),
          inject: [AwsCredentials]
        },
      ]
    });
  }
}