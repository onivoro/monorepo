import { Injectable } from '@nestjs/common';
import { KinesisClient, PutRecordCommand, PutRecordCommandInput } from '@aws-sdk/client-kinesis';
import { ServerAwsKinesisConfig } from '../classes/server-aws-kinesis-config.class';

@Injectable()
export class KinesisService {
    constructor(private kinesis: KinesisClient, private config: ServerAwsKinesisConfig) { }

    async publish<TData>(event: TData, PartitionKey: string) {

        try {
            const input: PutRecordCommandInput = {
                Data: Buffer.from(JSON.stringify(event)),
                PartitionKey,
                StreamName: this.config.AWS_KINESIS_NAME,
            };

            const command = new PutRecordCommand(input);

            await this.kinesis.send(command);
        } catch (err) {
            console.error(`Error sending data to Kinesis:`, event, err);
        }
    }
}