import { ECS, RunTaskCommand } from '@aws-sdk/client-ecs';
import { EcsService } from './ecs.service';

describe(EcsService.name, () => {
  describe(EcsService.mapObjectToEcsEnvironmentArray.name, () => {
    it.each([
      [{ hot: 'sauce' }],
      [null],
      [{ age: 337 }],
      [{ enabled: true, port: 3000 }],
    ])('given "%j", lives up to its name', (_) => {
      expect(EcsService.mapObjectToEcsEnvironmentArray(_)).toMatchSnapshot();
    });
  });

  describe('runTasks', () => {
    const input = {
      taskDefinition: 'td:1',
      subnets: 'subnet-a, subnet-b,',
      securityGroups: 'sg-a',
      taskCount: 2,
      cluster: 'c',
    };

    it('sends one RunTaskCommand per task', async () => {
      const send = jest.fn().mockResolvedValue({ tasks: [] });
      const service = new EcsService({ send } as unknown as ECS);

      await expect(service.runTasks(input)).resolves.toEqual([
        { tasks: [] },
        { tasks: [] },
      ]);
      expect(send).toHaveBeenCalledTimes(2);
      const command: RunTaskCommand = send.mock.calls[0][0];
      expect(command.input.networkConfiguration?.awsvpcConfiguration).toEqual({
        assignPublicIp: 'DISABLED',
        subnets: ['subnet-a', 'subnet-b'],
        securityGroups: ['sg-a'],
      });
    });

    it('builds a Fargate RunTask request with the given overrides', async () => {
      const send = jest.fn().mockResolvedValue({ tasks: [] });
      const service = new EcsService({ send } as unknown as ECS);
      const overrides = {
        containerOverrides: [
          { name: 'app', environment: [{ name: 'A', value: '1' }] },
        ],
      };

      await service.runTasks({ ...input, taskCount: 1, overrides });

      expect(send.mock.calls[0][0].input).toEqual({
        cluster: 'c',
        taskDefinition: 'td:1',
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            assignPublicIp: 'DISABLED',
            subnets: ['subnet-a', 'subnet-b'],
            securityGroups: ['sg-a'],
          },
        },
        overrides,
      });
    });

    it('sends nothing when taskCount is 0', async () => {
      const send = jest.fn();
      const service = new EcsService({ send } as unknown as ECS);

      await expect(
        service.runTasks({ ...input, taskCount: 0 }),
      ).resolves.toEqual([]);
      expect(send).not.toHaveBeenCalled();
    });

    it('logs and rethrows when a RunTask request rejects', async () => {
      const error = new Error('boom');
      const send = jest.fn().mockRejectedValue(error);
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const service = new EcsService({ send } as unknown as ECS);

      await expect(service.runTasks(input)).rejects.toBe(error);
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to run ECS task:',
        error,
      );
      consoleError.mockRestore();
    });
  });
});
