import { Injectable } from '@nestjs/common';
import { DeleteMessageBatchCommand, GetQueueAttributesCommand, ReceiveMessageCommand, SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { ServerAwsSqsConfig } from '../classes/server-aws-sqs-config.class';

@Injectable()
export class SqsService {
  constructor(private sqs: SQSClient, private config: ServerAwsSqsConfig) { }

  async publish<TData>(event: TData) {

    try {
      const command = new SendMessageCommand({
        MessageBody: JSON.stringify(event),
        QueueUrl: this.config.AWS_SQS_URL,

      });

      await this.sqs.send(command);
    } catch (err) {
      console.error(`Error sending data to SQS:`, event, err);
    }
  }

  async verifyQueue() {
    const QueueUrl = this.config.AWS_SQS_URL;
    try {
      const command = new GetQueueAttributesCommand({
        QueueUrl,
        AttributeNames: ['QueueArn']
      });
      await this.sqs.send(command);
      console.log('Queue verification successful');
      return true;
    } catch (error: any) {
      if (error.name === 'AWS.SimpleQueueService.NonExistentQueue') {
        console.error('Queue does not exist:', QueueUrl);
      } else if (error.name === 'AccessDeniedException') {
        console.error('Permission denied. Check IAM roles/policies');
      } else {
        console.error('Queue verification failed:', error.message);
      }
      throw error;
    }
  }

  async getApproximateNumberOfMessages(): Promise<number> {
    try {
      const queueAttrs = await this.sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: this.config.AWS_SQS_URL,
          AttributeNames: ['ApproximateNumberOfMessages']
        })
      );

      const messageCount = parseInt(
        queueAttrs.Attributes?.ApproximateNumberOfMessages || '0'
      );

      return messageCount;
    } catch (error) {
      console.error({ error, detail: `Failed to determine ApproximateNumberOfMessages for queue ${this.config.AWS_SQS_URL}:` });
      throw error;
    }
  }

  async processMessageBatches(maxIterations: number) {
    let iteration = 0;
    let messageCount = await this.getApproximateNumberOfMessages();

    while ((iteration < maxIterations) && !!messageCount) {
      try {

        messageCount = await this.getApproximateNumberOfMessages();

        const response = await this.sqs.send(new ReceiveMessageCommand({
          QueueUrl: this.config.AWS_SQS_URL,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          VisibilityTimeout: 30
        }));

        const messages = response.Messages || [];

        console.log(`Received ${messages.length} messages`);

        const parsedMessages: Event[] = messages.map(({ Body }: any) => JSON.parse(Body || '{}'));

        console.log(parsedMessages);

        if (parsedMessages?.length) {
          console.log(`processing messages iteration ${iteration}`);

          const Entries = messages.map((_) => ({ ReceiptHandle: _.ReceiptHandle, Id: _.MessageId }));

          await this.sqs.send(new DeleteMessageBatchCommand({
            QueueUrl: this.config.AWS_SQS_URL,
            Entries
          }));

          console.log('Deleted messages:', Entries);
        }

      } catch (error) {
        console.error('Error polling messages:', error);
      }

      iteration++;
    }
  }
}