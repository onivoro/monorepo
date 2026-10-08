import { Test } from '@nestjs/testing';
import { ECS } from '@aws-sdk/client-ecs';
import { ServerAwsEcsModule } from './server-aws-ecs.module';
import { ServerAwsEcsConfig } from './classes/server-aws-ecs-config.class';
import { EcsService } from './services/ecs.service';

describe(ServerAwsEcsModule.name, () => {
  const config: ServerAwsEcsConfig = { AWS_REGION: 'eu-west-1' };

  it('configure returns a dynamic module for ServerAwsEcsModule', () => {
    const dynamicModule = ServerAwsEcsModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsEcsModule);
    expect(dynamicModule.providers).toContain(EcsService);
    expect(dynamicModule.providers).toContainEqual({
      provide: ServerAwsEcsConfig,
      useValue: config,
    });
  });

  it('wires EcsService to an ECS client in the configured region', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsEcsModule.configure(config)],
    }).compile();

    const client = moduleRef.get(ECS);
    expect(client).toBeInstanceOf(ECS);
    await expect(client.config.region()).resolves.toBe('eu-west-1');
    expect(moduleRef.get(EcsService)).toBeInstanceOf(EcsService);
    expect(moduleRef.get(ServerAwsEcsConfig)).toBe(config);
  });
  it('reuses the same ECS client when the module is compiled again', async () => {
    const compile = () =>
      Test.createTestingModule({
        imports: [ServerAwsEcsModule.configure(config)],
      }).compile();
    const [first, second] = [await compile(), await compile()];

    expect(second.get(ECS)).toBe(first.get(ECS));
  });
});
