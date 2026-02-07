import { Injectable } from '@nestjs/common';
import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose';
import { ServerAwsFirehoseConfig } from '../server-aws-firehose-config.class';

@Injectable()
export class FirehoseService {
  constructor(
    private config: ServerAwsFirehoseConfig,
    private firehoseClient: FirehoseClient,
  ) {}

  async putRecord(
    data: any,
    eventId: string,
  ): Promise<void> {
    const record = JSON.stringify(data) + '\n';

    try {
      const command = new PutRecordCommand({
        DeliveryStreamName: this.config.AWS_FIREHOSE_NAME,
        Record: {
          Data: Buffer.from(record),
        },
      });

      await this.firehoseClient.send(command);
    } catch (error: any) {
      console.error({
        detail: 'failed to put record to Firehose',
        error: error?.message,
      });
      throw error;
    }
  }
}
