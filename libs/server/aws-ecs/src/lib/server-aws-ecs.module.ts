import { Module } from '@nestjs/common';
import { moduleFactory } from '@onivoro/server/common';
import { ECS } from '@aws-sdk/client-ecs';
import { EcsService } from './services/ecs.service';
import { ServerAwsEcsConfig } from './classes/server-aws-ecs-config.class';
import { AwsCredentials, ServerAwsCredentialProvidersModule } from '@onivoro/server/aws-credential-providers';

let ecsClient: ECS | null = null;

@Module({})
export class ServerAwsEcsModule {
  static configure(config: ServerAwsEcsConfig) {
    return moduleFactory({
      module: ServerAwsEcsModule,
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
      providers: [
        {
          provide: ECS,
          useFactory: (credentials: AwsCredentials) => ecsClient
            ? ecsClient
            : ecsClient = new ECS({
              region: config.AWS_REGION,
              logger: console,
              credentials
            }),
            inject: [AwsCredentials]
        },
        { provide: ServerAwsEcsConfig, useValue: config },
        EcsService
      ],
    })
  }
}
