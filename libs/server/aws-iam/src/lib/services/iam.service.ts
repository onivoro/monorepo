import { Injectable } from '@nestjs/common';
import { AttachGroupPolicyCommand, CreatePolicyCommand, GetGroupCommand, IAMClient } from '@aws-sdk/client-iam';
import { ServerAwsIamConfig } from '../classes/server-aws-iam-config.class';

@Injectable()
export class IamService {
    constructor(public readonly iamClient: IAMClient, private config: ServerAwsIamConfig) { }

    async getGroup(GroupName: string) {
        return await this.iamClient.send(new GetGroupCommand({ GroupName }));
    }

    async createPolicy(createPolicyCommand: CreatePolicyCommand) {
        const policy = await this.iamClient.send(createPolicyCommand);

        if (!policy?.Policy) {
            console.error(`Failed to create IAM policy "${createPolicyCommand.input.PolicyName}"`);

            return;
        }

        return policy;
    }

    async attachPolicyToGroup(params: { PolicyArn: string, GroupName: string }) {
        const { PolicyArn, GroupName } = params;

        try {
            const attachPolicyCommand = new AttachGroupPolicyCommand({ GroupName, PolicyArn });

            return await this.iamClient.send(attachPolicyCommand);
        } catch (error: any) {
            console.error({ detail: `Failed to attach policy "${PolicyArn}" to group "${GroupName}"`, error });
        }
    }

}