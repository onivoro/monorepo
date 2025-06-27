import { Injectable } from "@nestjs/common";
import { ECS, KeyValuePair, RunTaskCommand, RunTaskCommandInput, RunTaskCommandOutput } from '@aws-sdk/client-ecs';
import { parseCsvString } from "../functions/parse-csv-string.function";

@Injectable()
export class EcsService {

  constructor(private ecsClient: ECS) { }

  runTasks(_: { taskDefinition: string, subnets: string, securityGroups: string, taskCount: number, cluster: string } & Pick<RunTaskCommandInput, 'overrides'>): Promise<Array<RunTaskCommandOutput>> {
    const { taskDefinition, subnets, securityGroups, taskCount, cluster, overrides } = _;
    try {
      const params: RunTaskCommandInput = {
        cluster,
        taskDefinition,
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            assignPublicIp: 'DISABLED',
            subnets: parseCsvString(subnets),
            securityGroups: parseCsvString(securityGroups),
          }
        },
        overrides
      };

      const taskPromises = new Array(taskCount)
        .fill(undefined)
        .map(() => this.ecsClient.send(new RunTaskCommand(params)));

      return Promise.all(taskPromises);
    } catch (error) {
      console.error('Failed to run ECS task:', error);
      throw error;
    }
  }

  static mapObjectToEcsEnvironmentArray (_: Record<string, any> | null | undefined): KeyValuePair[] {
    return Object.entries(_ || {} as Record<string, any>).reduce((__, [Name, Value]) => [...__, {Name, Value}], [] as any);
  }
}
