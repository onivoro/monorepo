import { Injectable } from '@nestjs/common';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { ServerAwsStsConfig } from '../classes/server-aws-sts-config.class';

@Injectable()
export class StsService {
    constructor(public readonly stsClient: STSClient, private config: ServerAwsStsConfig) { }

    async getAccountId() {
        const response = await this.stsClient.send(new GetCallerIdentityCommand({}));
        return response.Account;
    }
}